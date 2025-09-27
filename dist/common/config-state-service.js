import { createLogger } from "./log.js";
import { sendRuntimeMessage } from "./messaging.js";
const STORAGE_KEY = "gesture-config";
const STORAGE_VERSION = 1;
const logger = createLogger("ConfigStateService");
const readArea = (area) => new Promise((resolve, reject) => {
    // Handles async chrome storage read.
    const handler = (items) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
            reject(new Error(lastError.message));
            return;
        }
        const stored = items[STORAGE_KEY];
        resolve(stored ?? null);
    };
    try {
        area.get(STORAGE_KEY, handler);
    }
    catch (error) {
        reject(error);
    }
});
const writeArea = (area, envelope) => new Promise((resolve, reject) => {
    // Handles async chrome storage write.
    const handler = () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
            reject(new Error(lastError.message));
            return;
        }
        resolve();
    };
    try {
        area.set({ [STORAGE_KEY]: envelope }, handler);
    }
    catch (error) {
        reject(error);
    }
});
export class ConfigStateService {
    constructor() {
        this.cache = null;
        this.subscribers = [];
    }
    // Reads configuration from sync/local storage.
    async read() {
        if (this.cache) {
            return this.cache;
        }
        try {
            const fromSync = await readArea(chrome.storage.sync);
            if (fromSync) {
                logger.info("Loaded configuration from sync storage");
                const snapshot = { source: "sync", value: fromSync.config };
                this.cache = snapshot;
                return snapshot;
            }
        }
        catch (error) {
            logger.error("Failed reading sync storage", error);
        }
        try {
            const fromLocal = await readArea(chrome.storage.local);
            if (fromLocal) {
                logger.info("Loaded configuration from local storage");
                const snapshot = { source: "local", value: fromLocal.config };
                this.cache = snapshot;
                return snapshot;
            }
        }
        catch (error) {
            logger.error("Failed reading local storage", error);
        }
        logger.info("No stored configuration found");
        return null;
    }
    // Writes configuration and notifies listeners.
    async save(config) {
        const envelope = { version: STORAGE_VERSION, config };
        try {
            await writeArea(chrome.storage.sync, envelope);
            logger.info("Saved configuration to sync storage");
            this.cache = { source: "sync", value: config };
        }
        catch (syncError) {
            logger.error("Sync storage save failed, falling back to local", syncError);
            await writeArea(chrome.storage.local, envelope);
            logger.info("Saved configuration to local storage");
            this.cache = { source: "local", value: config };
        }
        this.emit();
        const message = {
            type: "config/updated",
            payload: { config }
        };
        await sendRuntimeMessage(message);
    }
    // Subscribes to configuration updates.
    subscribe(callback) {
        this.subscribers.push(callback);
        if (this.cache) {
            callback(this.cache);
        }
        return () => {
            this.subscribers = this.subscribers.filter((subscriber) => subscriber !== callback);
        };
    }
    // Updates cache and notifies subscribers.
    setCache(snapshot) {
        this.cache = snapshot;
        this.emit();
    }
    // Returns cached configuration.
    getCached() {
        return this.cache;
    }
    emit() {
        if (!this.cache) {
            return;
        }
        for (const subscriber of this.subscribers) {
            subscriber(this.cache);
        }
    }
}
export const configStateService = new ConfigStateService();
