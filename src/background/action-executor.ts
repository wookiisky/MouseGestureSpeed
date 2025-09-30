import { createLogger } from "../common/log.js";
import type { GestureAction, GestureActionPayload } from "../common/types.js";

const logger = createLogger("BackgroundActionExecutor");

// Opens extension options page
const openOptionsPage = () =>
  new Promise<void>((resolve) => {
    chrome.runtime.openOptionsPage(() => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        logger.error("Failed to open options page", lastError.message);
      } else {
        logger.info("Opened options page");
      }
      resolve();
    });
  });

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

// Restores the most recently closed tab or window
const restoreLastClosed = async () => {
  await chrome.sessions.restore();
};

// Gets a tab by id.
const getTab = (tabId: number) =>
  new Promise<chrome.tabs.Tab>((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(tab);
    });
  });

// Queries tabs in a window ordered by index.
const getTabsInWindow = (windowId: number) =>
  new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
    chrome.tabs.query({ windowId }, (tabs) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      const sorted = [...tabs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      resolve(sorted);
    });
  });

// Activates a tab by id.
const activateTab = (tabId: number) =>
  new Promise<void>((resolve, reject) => {
    chrome.tabs.update(tabId, { active: true }, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve();
    });
  });

// Opens a URL in a new tab (same window when possible).
const openUrlInNewTab = (url: string, windowId?: number) =>
  new Promise<void>((resolve, reject) => {
    // Try to open the URL directly; Chrome will reject unsupported targets.
    logger.info("Attempting to open URL", { url });
    chrome.tabs.create({ url, windowId }, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        logger.error("tabs.create failed for OPEN_URL", lastError.message);
        reject(new Error(lastError.message));
        return;
      }
      logger.info("Opened URL in new tab", { url });
      resolve();
    });
  });

// Switches to adjacent tab if exists.
const switchAdjacentTab = async (sender: chrome.runtime.MessageSender, direction: "left" | "right") => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    logger.error("Cannot switch tab: sender tab missing");
    return;
  }

  let current: chrome.tabs.Tab;
  try {
    current = await getTab(tabId);
  } catch (e) {
    logger.error("Failed to get current tab", e);
    return;
  }

  const windowId = current.windowId;
  if (windowId === undefined) {
    logger.error("Cannot switch tab: windowId missing");
    return;
  }

  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await getTabsInWindow(windowId);
  } catch (e) {
    logger.error("Failed to query tabs in window", e);
    return;
  }

  const currentIndex = current.index ?? tabs.findIndex((t) => t.id === tabId);
  if (currentIndex < 0) {
    logger.error("Current tab index not found");
    return;
  }

  const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
  const target = tabs.find((t) => t.index === targetIndex);
  if (!target || target.id === undefined) {
    logger.info("No adjacent tab to switch", { direction, currentIndex });
    return;
  }

  try {
    await activateTab(target.id);
    logger.info(`Activated ${direction} tab`, { from: currentIndex, to: targetIndex, tabId: target.id });
  } catch (e) {
    logger.error("Failed to activate adjacent tab", e);
  }
};

export class BackgroundActionExecutor {
  // Executes privileged action through background context.
  async execute(action: GestureAction, sender: chrome.runtime.MessageSender, payload?: GestureActionPayload) {
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
      case "OPEN_OPTIONS_PAGE": {
        await openOptionsPage();
        break;
      }
      case "REOPEN_CLOSED_TAB": {
        try {
          await restoreLastClosed();
          logger.info("Restored last closed tab or window");
        } catch (error) {
          logger.error("Failed to restore last closed item", error);
        }
        break;
      }
      case "SWITCH_TAB_LEFT": {
        await switchAdjacentTab(sender, "left");
        break;
      }
      case "SWITCH_TAB_RIGHT": {
        await switchAdjacentTab(sender, "right");
        break;
      }
      case "OPEN_URL": {
        const url = payload?.url ?? "";
        if (!url) {
          logger.error("OPEN_URL missing url in payload");
          return;
        }
        try {
          await openUrlInNewTab(url, sender.tab?.windowId);
        } catch (e) {
          logger.error("Failed to open URL", e as unknown);
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
