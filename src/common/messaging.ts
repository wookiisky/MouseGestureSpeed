import { createLogger } from "./log.js";
import type { RuntimeMessage, RuntimeMessageType } from "./types.js";

const logger = createLogger("MessagingChannel");

type MessageHandler<T extends RuntimeMessage> = (message: T, sender: chrome.runtime.MessageSender) => void | Promise<void>;

const activeHandlers: Array<{ type: RuntimeMessageType; handler: MessageHandler<any> }> = [];

// Sends a runtime message.
export const sendRuntimeMessage = async <T extends RuntimeMessage>(message: T) => {
  try {
    // Skip if extension runtime is unavailable (e.g., before load or reloaded).
    const canSend = typeof chrome !== "undefined" && !!chrome.runtime && typeof chrome.runtime.sendMessage === "function";
    if (!canSend) {
      logger.warn(`Skip sending ${message.type}: runtime not ready`);
      return;
    }
    logger.info(`Sending message ${message.type}`);
    await chrome.runtime.sendMessage(message);
    logger.info(`Message ${message.type} sent successfully`);
  } catch (error) {
    // Handle and swallow errors; only warn.
    const msg = error instanceof Error ? error.message : String(error ?? "");
    if (
      msg.includes("Extension context invalidated") ||
      msg.includes("Cannot read properties of undefined (reading 'sendMessage')") ||
      msg.includes("Cannot read property 'sendMessage'")
    ) {
      logger.warn(`Context invalidated while sending ${message.type}; message ignored`, error);
      return;
    }
    logger.warn(`Failed to send message ${message.type}`, error);
    return;
  }
};

// Registers listener for a specific message type.
export const onRuntimeMessage = <T extends RuntimeMessage>(type: RuntimeMessageType, handler: MessageHandler<T>) => {
  // Guard against missing runtime during early/invalidated states.
  const canListen = typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === "function";
  if (!canListen) {
    logger.warn(`Skip registering listener for ${type}: runtime not ready`);
    return () => {
      // no-op unsubscribe
    };
  }

  const wrapped = (message: RuntimeMessage, sender: chrome.runtime.MessageSender) => {
    if (message.type !== type) {
      return;
    }
    const tabId = sender.tab?.id;
    logger.info(`Received message ${type} from ${tabId !== undefined ? `tab ${tabId}` : "unknown sender"}`);
    handler(message as T, sender);
  };

  activeHandlers.push({ type, handler: wrapped });
  chrome.runtime.onMessage.addListener(wrapped);
  logger.info(`Registered listener for ${type}`);

  return () => {
    try {
      chrome.runtime.onMessage.removeListener(wrapped);
    } catch (e) {
      logger.warn(`Failed to remove listener for ${type}`, e as unknown);
    }
    const index = activeHandlers.findIndex((item) => item.handler === wrapped);
    if (index >= 0) {
      activeHandlers.splice(index, 1);
    }
    logger.info(`Removed listener for ${type}`);
  };
};

// Removes all active listeners.
export const removeAllRuntimeListeners = () => {
  try {
    for (const item of activeHandlers) {
      chrome.runtime.onMessage.removeListener(item.handler);
    }
  } catch (e) {
    logger.warn("Failed to clear some runtime listeners", e as unknown);
  }
  activeHandlers.splice(0, activeHandlers.length);
  logger.info("Cleared all runtime listeners");
};
