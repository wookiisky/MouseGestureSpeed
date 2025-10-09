import { backgroundActionExecutor } from "./action-executor.js";
import { configStateService } from "../common/config-state-service.js";
import { createLogger } from "../common/log.js";
import { onRuntimeMessage } from "../common/messaging.js";
import type {
  GestureActionPayload,
  GestureConfig,
  GestureTriggeredPayload,
  RuntimeMessage,
  SuppressContextMenuPayload,
  RightMouseStatePayload,
  RightMouseStateCurrentPayload
} from "../common/types.js";

const logger = createLogger("BackgroundEntry");

// Tracks global right mouse button state across tabs
let rightMouseDown = false;
let rightMouseUpdatedAt = 0;

// Sends runtime message to a tab.
const sendTabMessage = (tabId: number, message: RuntimeMessage) =>
  new Promise<void>((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve();
    });
  });

// Ensures config cache is ready for fast lookup.
const ensureConfigCached = async () => {
  try {
    const snapshot = await configStateService.read();
    if (snapshot) {
      logger.info(`Background cached config from ${snapshot.source}`);
    } else {
      logger.info("Background fallback to default config until update");
    }
  } catch (error) {
    logger.error("Failed to warm config cache", error);
  }
};

// Handles config request from content scripts.
const handleConfigRequest = async (tabId: number) => {
  const snapshot = configStateService.getCached();
  if (!snapshot) {
    logger.info("No cached config available for request");
    return;
  }

  const message: RuntimeMessage<"config/current", { config: GestureConfig }> = {
    type: "config/current",
    payload: { config: snapshot.value }
  };

  try {
    await sendTabMessage(tabId, message);
    logger.info(`Pushed config to tab ${tabId}`);
  } catch (error) {
    logger.error("Failed to send config to tab", error);
  }
};

// Boots background service worker.
const bootstrap = async () => {
  await ensureConfigCached();
  logger.info("Background service worker initialized");
};

onRuntimeMessage<RuntimeMessage<"gesture/action", GestureActionPayload>>("gesture/action", async (message, sender) => {
  const action = message.payload.action;
  const tabId = sender.tab?.id;
  logger.info(`Received gesture action ${action} from ${tabId !== undefined ? `tab ${tabId}` : "unknown tab"}`);
  await backgroundActionExecutor.execute(message.payload.action, sender, message.payload);
  // For actions that change the active tab, arm contextmenu suppression in new tab
  if (action === "CLOSE_TAB" || action === "SWITCH_TAB_LEFT" || action === "SWITCH_TAB_RIGHT" || action === "REOPEN_CLOSED_TAB") {
    const windowId = sender.tab?.windowId;
    try {
      await suppressContextMenuInWindow(windowId);
    } catch (e) {
      logger.warn("Failed to send suppress-contextmenu signal", e as unknown);
    }
  }
});

onRuntimeMessage<RuntimeMessage<"config/request", undefined>>("config/request", async (_message, sender) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    logger.error("Config request missing tab context");
    return;
  }

  await handleConfigRequest(tabId);
});

onRuntimeMessage<RuntimeMessage<"gesture/triggered", GestureTriggeredPayload>>("gesture/triggered", async (message) => {
  logger.info("Gesture telemetry", message.payload);
});

// Updates right mouse button state
onRuntimeMessage<RuntimeMessage<"rmb/state-update", RightMouseStatePayload>>("rmb/state-update", async (message, sender) => {
  rightMouseDown = Boolean(message.payload.down);
  rightMouseUpdatedAt = Date.now();
  const tabId = sender.tab?.id;
  logger.info(`RMB state updated to ${rightMouseDown} from ${tabId !== undefined ? `tab ${tabId}` : "unknown"}`);
});

// Responds with current RMB state
onRuntimeMessage<RuntimeMessage<"rmb/state-request", undefined>>("rmb/state-request", async (_message, sender) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    logger.warn("RMB state request without tab context");
    return;
  }
  const payload: RightMouseStateCurrentPayload = { down: rightMouseDown };
  const msg: RuntimeMessage<"rmb/state-current", RightMouseStateCurrentPayload> = {
    type: "rmb/state-current",
    payload
  };
  try {
    await sendTabMessage(tabId, msg);
    logger.info(`Sent RMB state to tab ${tabId}: down=${payload.down}`);
  } catch (e) {
    logger.warn("Failed to send RMB state to tab", e as unknown);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  logger.info("Extension installed or updated");
});

// Attempts to detect if content script is active in tab.
const isContentActive = (tabId: number) =>
  new Promise<boolean>((resolve) => {
    try {
      // Ping with a dummy message; if no receiver, lastError will be set.
      chrome.tabs.sendMessage(tabId, { type: "internal/ping", payload: undefined }, () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (_err) {
      resolve(false);
    }
  });

// Injects the content entrypoint using scripting API (fallback path).
const injectContent = async (tabId: number) => {
  try {
    logger.info(`Attempting to inject content into tab ${tabId}`);
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "ISOLATED",
      injectImmediately: true,
      args: [["content/entrypoint.js", "dist/content/entrypoint.js"]],
      func: (candidates: string[]) => {
        const tryImport = async (path: string) => {
          try {
            const url = chrome.runtime.getURL(path);
            // eslint-disable-next-line no-await-in-loop
            await import(url);
            console.info("[BackgroundInjector] Loaded", { path });
            return true;
          } catch (error) {
            console.warn("[BackgroundInjector] Import failed", { path, error });
            return false;
          }
        };

        (async () => {
          for (const path of candidates) {
            // eslint-disable-next-line no-await-in-loop
            const ok = await tryImport(path);
            if (ok) return;
          }
          console.error("[BackgroundInjector] All imports failed");
          try {
            if (!document.getElementById("mg-reload-prompt")) {
              const el = document.createElement("div");
              el.id = "mg-reload-prompt";
              el.textContent = "Click to reload page, to enable MouseGestureSpeed";
              el.setAttribute("role", "button");
              el.setAttribute("tabindex", "0");
              el.style.position = "fixed";
              el.style.right = "16px";
              el.style.bottom = "16px";
              el.style.zIndex = "2147483647";
              el.style.background = "#111";
              el.style.color = "#fff";
              el.style.padding = "10px 12px";
              el.style.borderRadius = "8px";
              el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.4)";
              el.style.fontFamily = "-apple-system,Segoe UI,Helvetica,Arial,sans-serif";
              el.style.fontSize = "13px";
              el.style.cursor = "pointer";
              el.style.userSelect = "none";
              el.addEventListener("click", () => {
                console.info("[BackgroundInjector] Reload prompt clicked");
                window.location.reload();
              });
              el.addEventListener("keydown", (e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  el.click();
                }
              });
              document.documentElement.appendChild(el);
              console.info("[BackgroundInjector] Inserted reload prompt overlay");
            }
          } catch (err) {
            console.warn("[BackgroundInjector] Failed to insert reload prompt", err);
          }
        })().catch((e) => console.error("[BackgroundInjector] Unexpected error", e));
      }
    });
    logger.info(`Injection script executed for tab ${tabId}`);
  } catch (error) {
    logger.error("Content injection failed", error);
  }
};

// Ensures content is active in given tab.
const ensureContentActive = async (tabId: number) => {
  const active = await isContentActive(tabId);
  if (active) {
    logger.info(`Content already active in tab ${tabId}`);
    return;
  }
  logger.info(`Content not active in tab ${tabId}; attempting injection`);
  await injectContent(tabId);
};

// Sends a suppress-contextmenu signal to the active tab in a window.
const suppressContextMenuInWindow = async (windowId?: number, windowMs: number = 0) => {
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
      chrome.tabs.query({ active: true, windowId, currentWindow: windowId === undefined ? true : undefined }, (result) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve(result);
      });
    });
  } catch (e) {
    logger.error("tabs.query failed when locating active tab for suppression", e);
    return;
  }
  const target = tabs[0];
  const targetId = target?.id;
  if (targetId === undefined) {
    logger.info("No active tab found to suppress contextmenu");
    return;
  }

  try {
    await ensureContentActive(targetId);
  } catch (e) {
    logger.warn("Failed to ensure content active before suppression", e as unknown);
  }

  const message: RuntimeMessage<"gesture/suppress-contextmenu", SuppressContextMenuPayload> = {
    type: "gesture/suppress-contextmenu",
    payload: { windowMs }
  };

  try {
    await sendTabMessage(targetId, message);
    logger.info(`Sent suppress-contextmenu to tab ${targetId}`);
  } catch (e) {
    logger.warn("Failed to post suppress-contextmenu to tab", e as unknown);
  }
};

// Builds an origin pattern for host permission checks.
const toOriginPattern = (url: string) => {
  try {
    const u = new URL(url);
    // Only http/https origins are valid for permission requests
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      logger.info("Unsupported scheme for origin pattern", { url, protocol: u.protocol });
      return null;
    }
    return `${u.origin}/*`;
  } catch {
    return null;
  }
};

// Returns true if URL is restricted by Chrome.
const isRestrictedUrl = (url: string) => /^(chrome|chrome-extension|chrome-search|chrome-untrusted|edge|about|devtools):/i.test(url);

// Checks whether we have host permission for the origin.
const hasHostPermission = (pattern: string) =>
  new Promise<boolean>((resolve) => {
    try {
      chrome.permissions.contains({ origins: [pattern] }, (granted) => {
        const err = chrome.runtime.lastError;
        if (err) {
          logger.info("permissions.contains warning", { pattern, error: err.message });
          resolve(false);
          return;
        }
        resolve(Boolean(granted));
      });
    } catch (e) {
      logger.info("permissions.contains warning", { pattern, error: String(e) });
      resolve(false);
    }
  });

// Requests host permission for a specific origin.
const requestHostPermission = (pattern: string) =>
  new Promise<boolean>((resolve) => {
    try {
      chrome.permissions.request({ origins: [pattern] }, (granted) => {
        const err = chrome.runtime.lastError;
        if (err) {
          logger.info("permissions.request warning", { pattern, error: err.message });
          resolve(false);
          return;
        }
        resolve(Boolean(granted));
      });
    } catch (e) {
      logger.info("permissions.request warning", { pattern, error: String(e) });
      resolve(false);
    }
  });

// On page load complete, try auto injection only if host permission exists.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab?.url) {
    return;
  }

  if (isRestrictedUrl(tab.url)) {
    logger.info("Skip auto injection on restricted url", tab.url);
    return;
  }

  const pattern = toOriginPattern(tab.url);
  if (!pattern) {
    return;
  }

  (async () => {
    const allowed = await hasHostPermission(pattern);
    if (!allowed) {
      logger.info(`No host permission for ${pattern}; skip auto injection`);
      return;
    }
    await ensureContentActive(tabId);
  })().catch((error) => logger.error("Auto injection task failed", error));
});

// Allow manual activation via toolbar button.
chrome.action.onClicked.addListener((tab) => {
  const tabId = tab.id;
  if (tabId === undefined) {
    logger.error("Action clicked without tab context");
    return;
  }

  const url = tab.url;
  if (!url) {
    logger.error("Action clicked but missing tab url");
    return;
  }

  if (isRestrictedUrl(url)) {
    logger.info("Skip manual injection on restricted url", url);
    return;
  }

  const pattern = toOriginPattern(url);
  if (!pattern) {
    logger.error("Failed to derive origin pattern from url", url);
    return;
  }

  (async () => {
    const allowed = await hasHostPermission(pattern);
    if (!allowed) {
      logger.info(`Requesting host permission for ${pattern}`);
      const granted = await requestHostPermission(pattern);
      if (granted) {
        logger.info(`Host permission granted for ${pattern}`);
      } else {
        logger.info(`Host permission denied for ${pattern}; will try ActiveTab`);
      }
    }
    await ensureContentActive(tabId);
  })().catch((error) => logger.error("Manual injection task failed", error));
});

void bootstrap();
