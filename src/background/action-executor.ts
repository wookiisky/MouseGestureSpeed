import { createLogger } from "../common/log.js";
import type { GestureAction } from "../common/types.js";

const logger = createLogger("BackgroundActionExecutor");

const removeTab = (tabId: number) =>
  new Promise<void>((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve();
    });
  });

export class BackgroundActionExecutor {
  // Executes privileged action through background context.
  async execute(action: GestureAction, sender: chrome.runtime.MessageSender) {
    switch (action) {
      case "CLOSE_TAB": {
        const tabId = sender.tab?.id;
        if (tabId === undefined) {
          logger.error("Cannot close tab: sender tab missing");
          return;
        }

        try {
          await removeTab(tabId);
          logger.info(`Closed tab ${tabId}`);
        } catch (error) {
          logger.error("Failed to close tab", error);
        }
        break;
      }
      default: {
        logger.info(`No background handler for action ${action}`);
      }
    }
  }
}

export const backgroundActionExecutor = new BackgroundActionExecutor();
