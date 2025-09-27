import { createLogger } from "./log.js";
import type { RuntimeMessage, RuntimeMessageType } from "./types.js";

const logger = createLogger("MessagingChannel");

type MessageHandler<T extends RuntimeMessage> = (message: T, sender: chrome.runtime.MessageSender) => void | Promise<void>;

const activeHandlers: Array<{ type: RuntimeMessageType; handler: MessageHandler<any> }> = [];

// Sends a runtime message.
export const sendRuntimeMessage = async <T extends RuntimeMessage>(message: T) => {
  try {
    logger.info(`Sending message ${message.type}`);
    await chrome.runtime.sendMessage(message);
    logger.info(`Message ${message.type} sent successfully`);
  } catch (error) {
    logger.error(`Failed to send message ${message.type}`, error);
    throw error;
  }
};

// Registers listener for a specific message type.
export const onRuntimeMessage = <T extends RuntimeMessage>(type: RuntimeMessageType, handler: MessageHandler<T>) => {
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
    chrome.runtime.onMessage.removeListener(wrapped);
    const index = activeHandlers.findIndex((item) => item.handler === wrapped);
    if (index >= 0) {
      activeHandlers.splice(index, 1);
    }
    logger.info(`Removed listener for ${type}`);
  };
};

// Removes all active listeners.
export const removeAllRuntimeListeners = () => {
  for (const item of activeHandlers) {
    chrome.runtime.onMessage.removeListener(item.handler);
  }
  activeHandlers.splice(0, activeHandlers.length);
  logger.info("Cleared all runtime listeners");
};
