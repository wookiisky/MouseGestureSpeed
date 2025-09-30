import { createLogger } from "../common/log.js";
import { sendRuntimeMessage } from "../common/messaging.js";
import type { GestureAction, GestureDefinition, RuntimeMessage } from "../common/types.js";

const logger = createLogger("ActionRouter");

const DOM_ACTIONS: Record<GestureAction, () => void> = {
  NAVIGATE_BACK: () => window.history.back(),
  NAVIGATE_FORWARD: () => window.history.forward(),
  SCROLL_TOP: () => window.scrollTo({ top: 0, behavior: "smooth" }),
  SCROLL_BOTTOM: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
  RELOAD: () => window.location.reload(),
  CLOSE_TAB: () => {
    // Placeholder, handled separately.
  },
  REOPEN_CLOSED_TAB: () => {
    // Placeholder, handled separately.
  },
  SWITCH_TAB_LEFT: () => {
    // Placeholder, handled by background.
  },
  SWITCH_TAB_RIGHT: () => {
    // Placeholder, handled by background.
  },
  OPEN_OPTIONS_PAGE: () => {
    // Placeholder, handled by background.
  },
  OPEN_URL: () => {
    // Placeholder, handled by background.
  }
};

const isDomAction = (action: GestureAction) =>
  action !== "CLOSE_TAB" &&
  action !== "REOPEN_CLOSED_TAB" &&
  action !== "SWITCH_TAB_LEFT" &&
  action !== "SWITCH_TAB_RIGHT" &&
  action !== "OPEN_OPTIONS_PAGE" && action !== "OPEN_URL";

export class ActionRouter {
  // Routes action to DOM or background.
  // Routes action to DOM or background.
  async dispatch(action: GestureAction, definition?: GestureDefinition) {
    if (isDomAction(action)) {
      logger.info(`Executing DOM action ${action}`);
      DOM_ACTIONS[action]();
      return;
    }

    const payload: { action: GestureAction; url?: string } = { action };
    if (action === "OPEN_URL" && definition?.url) {
      payload.url = definition.url;
      logger.info(`Including URL for OPEN_URL action: ${definition.url}`);
    }

    const message: RuntimeMessage<"gesture/action", { action: GestureAction; url?: string }> = {
      type: "gesture/action",
      payload
    };

    logger.info(`Forwarding action ${action} to background`);
    await sendRuntimeMessage(message);
  }
}

export const createActionRouter = () => new ActionRouter();
