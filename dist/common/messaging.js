import { createLogger } from "./log.js";
const logger = createLogger("MessagingChannel");
const activeHandlers = [];
// Sends a runtime message.
export const sendRuntimeMessage = async (message) => {
    try {
        logger.info(`Sending message ${message.type}`);
        await chrome.runtime.sendMessage(message);
        logger.info(`Message ${message.type} sent successfully`);
    }
    catch (error) {
        logger.error(`Failed to send message ${message.type}`, error);
        throw error;
    }
};
// Registers listener for a specific message type.
export const onRuntimeMessage = (type, handler) => {
    const wrapped = (message, sender) => {
        if (message.type !== type) {
            return;
        }
        const tabId = sender.tab?.id;
        logger.info(`Received message ${type} from ${tabId !== undefined ? `tab ${tabId}` : "unknown sender"}`);
        handler(message, sender);
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
