import { gestureConfigLoader } from "./gesture-config-loader.js";
import { createActionRouter } from "./action-router.js";
import { createGestureTracker } from "./gesture-tracker.js";
import { createGestureInterpreter } from "./gesture-interpreter.js";
import { createLogger } from "../common/log.js";
import { onRuntimeMessage, sendRuntimeMessage } from "../common/messaging.js";
const logger = createLogger("ContentEntry");
const actionRouter = createActionRouter();
const interpreter = createGestureInterpreter(() => gestureConfigLoader.getCurrent());
const tracker = createGestureTracker({
    onSequence: async (sequence) => {
        const match = interpreter.interpret(sequence);
        const payload = {
            sequence,
            action: match ? match.action : null
        };
        const message = {
            type: "gesture/triggered",
            payload
        };
        logger.info("Gesture detected", payload);
        await sendRuntimeMessage(message);
        if (match) {
            await actionRouter.dispatch(match.action);
        }
    }
});
// Boots the content script lifecycle.
const bootstrap = async () => {
    try {
        const config = await gestureConfigLoader.initialize();
        applyConfig(config);
        tracker.start();
        logger.info("Content script bootstrapped");
    }
    catch (error) {
        logger.error("Failed to initialize content script", error);
    }
};
// Applies configuration to tracker.
const applyConfig = (config) => {
    tracker.updateConfig(config);
};
onRuntimeMessage("config/updated", async (message) => {
    logger.info("Received configuration update");
    const merged = await gestureConfigLoader.applyUpdate(message.payload.config);
    applyConfig(merged);
});
void bootstrap();
