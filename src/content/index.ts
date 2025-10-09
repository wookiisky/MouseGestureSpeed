import { gestureConfigLoader } from "./gesture-config-loader.js";
import { createActionRouter } from "./action-router.js";
import { createGestureTracker } from "./gesture-tracker.js";
import { createGestureInterpreter } from "./gesture-interpreter.js";
import { createLogger } from "../common/log.js";
import { onRuntimeMessage, sendRuntimeMessage } from "../common/messaging.js";
import type {
  ConfigUpdatePayload,
  GestureConfig,
  GestureTriggeredPayload,
  RuntimeMessage,
  SuppressContextMenuPayload,
  RightMouseStateCurrentPayload
} from "../common/types.js";

const logger = createLogger("ContentEntry");

const actionRouter = createActionRouter();
const interpreter = createGestureInterpreter(() => gestureConfigLoader.getCurrent());
const tracker = createGestureTracker({
  onSequence: async (sequence) => {
    const match = interpreter.interpret(sequence);
    const payload: GestureTriggeredPayload = {
      sequence,
      action: match ? match.action : null
    };

    const message: RuntimeMessage<"gesture/triggered", GestureTriggeredPayload> = {
      type: "gesture/triggered",
      payload
    };

    logger.info("Gesture detected", payload);
    await sendRuntimeMessage(message);

    if (match) {
      await actionRouter.dispatch(match.action, match.definition);
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
    // Query initial RMB state to support chain close across tabs
    await sendRuntimeMessage({ type: "rmb/state-request", payload: undefined });
  } catch (error) {
    logger.error("Failed to initialize content script", error);
  }
};

// Applies configuration to tracker.
const applyConfig = (config: GestureConfig) => {
  tracker.updateConfig(config);
};

onRuntimeMessage<RuntimeMessage<"config/updated", ConfigUpdatePayload>>("config/updated", async (message) => {
  logger.info("Received configuration update");
  const merged = await gestureConfigLoader.applyUpdate(message.payload.config);
  applyConfig(merged);
});

onRuntimeMessage<RuntimeMessage<"gesture/suppress-contextmenu", SuppressContextMenuPayload>>(
  "gesture/suppress-contextmenu",
  (message) => {
    const windowMs = message.payload?.windowMs ?? 0;
    logger.info(`Received suppress-contextmenu signal windowMs=${windowMs}`);
    tracker.armContextMenuSuppression(windowMs);
  }
);

onRuntimeMessage<RuntimeMessage<"rmb/state-current", RightMouseStateCurrentPayload>>(
  "rmb/state-current",
  (message) => {
    const down = message.payload.down;
    logger.info(`Received RMB state: down=${down}`);
    tracker.setAssumedRightDown(Boolean(down));
  }
);

void bootstrap();
