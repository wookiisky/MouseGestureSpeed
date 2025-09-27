import { createLogger } from "../common/log.js";
import { sendRuntimeMessage } from "../common/messaging.js";
const logger = createLogger("ActionRouter");
const DOM_ACTIONS = {
    NAVIGATE_BACK: () => window.history.back(),
    NAVIGATE_FORWARD: () => window.history.forward(),
    SCROLL_TOP: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    SCROLL_BOTTOM: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
    RELOAD: () => window.location.reload(),
    CLOSE_TAB: () => {
        // Placeholder, handled separately.
    }
};
const isDomAction = (action) => action !== "CLOSE_TAB";
export class ActionRouter {
    // Routes action to DOM or background.
    async dispatch(action) {
        if (isDomAction(action)) {
            logger.info(`Executing DOM action ${action}`);
            DOM_ACTIONS[action]();
            return;
        }
        const message = {
            type: "gesture/action",
            payload: { action }
        };
        logger.info(`Forwarding action ${action} to background`);
        await sendRuntimeMessage(message);
    }
}
export const createActionRouter = () => new ActionRouter();
