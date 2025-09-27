import { createLogger } from "./log.js";
import { sendRuntimeMessage } from "./messaging.js";
import type {
  ConfigStateSnapshot,
  ConfigUpdatePayload,
  GestureConfig,
  RuntimeMessage,
  Subscriber,
  StoredConfigEnvelope
} from "./types.js";

const STORAGE_KEY = "gesture-config";
const STORAGE_VERSION = 1;

const logger = createLogger("ConfigStateService");

const readArea = (area: chrome.storage.StorageArea) =>
  new Promise<StoredConfigEnvelope | null>((resolve, reject) => {
    // Handles async chrome storage read.
    const handler = (items: Record<string, unknown>) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      const stored = items[STORAGE_KEY] as StoredConfigEnvelope | undefined;
      resolve(stored ?? null);
    };

    try {
      area.get(STORAGE_KEY, handler);
    } catch (error) {
      reject(error);
    }
  });

const writeArea = (area: chrome.storage.StorageArea, envelope: StoredConfigEnvelope) =>
  new Promise<void>((resolve, reject) => {
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
    } catch (error) {
      reject(error);
    }
  });

export class ConfigStateService {
  private cache: ConfigStateSnapshot | null = null;
  private subscribers: Subscriber<ConfigStateSnapshot>[] = [];

  // Reads configuration from sync/local storage.
  async read(): Promise<ConfigStateSnapshot | null> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const fromSync = await readArea(chrome.storage.sync);
      if (fromSync) {
        logger.info("Loaded configuration from sync storage");
        const snapshot: ConfigStateSnapshot = { source: "sync", value: fromSync.config };
        this.cache = snapshot;
        return snapshot;
      }
    } catch (error) {
      logger.error("Failed reading sync storage", error);
    }

    try {
      const fromLocal = await readArea(chrome.storage.local);
      if (fromLocal) {
        logger.info("Loaded configuration from local storage");
        const snapshot: ConfigStateSnapshot = { source: "local", value: fromLocal.config };
        this.cache = snapshot;
        return snapshot;
      }
    } catch (error) {
      logger.error("Failed reading local storage", error);
    }

    logger.info("No stored configuration found");
    return null;
  }

  // Writes configuration and notifies listeners.
  async save(config: GestureConfig): Promise<void> {
    const envelope: StoredConfigEnvelope = { version: STORAGE_VERSION, config };

    try {
      await writeArea(chrome.storage.sync, envelope);
      logger.info("Saved configuration to sync storage");
      this.cache = { source: "sync", value: config };
    } catch (syncError) {
      logger.error("Sync storage save failed, falling back to local", syncError);
      await writeArea(chrome.storage.local, envelope);
      logger.info("Saved configuration to local storage");
      this.cache = { source: "local", value: config };
    }

    this.emit();
    const message: RuntimeMessage<"config/updated", ConfigUpdatePayload> = {
      type: "config/updated",
      payload: { config }
    };

    await sendRuntimeMessage(message);
  }

  // Subscribes to configuration updates.
  subscribe(callback: Subscriber<ConfigStateSnapshot>) {
    this.subscribers.push(callback);
    if (this.cache) {
      callback(this.cache);
    }

    return () => {
      this.subscribers = this.subscribers.filter((subscriber) => subscriber !== callback);
    };
  }

  // Updates cache and notifies subscribers.
  setCache(snapshot: ConfigStateSnapshot) {
    this.cache = snapshot;
    this.emit();
  }

  // Returns cached configuration.
  getCached(): ConfigStateSnapshot | null {
    return this.cache;
  }

  private emit() {
    if (!this.cache) {
      return;
    }

    for (const subscriber of this.subscribers) {
      subscriber(this.cache);
    }
  }
}

export const configStateService = new ConfigStateService();
