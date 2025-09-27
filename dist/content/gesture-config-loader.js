import { configStateService } from "../common/config-state-service.js";
import { createLogger } from "../common/log.js";
import { mergeGestureConfigs, normalizeSequence, validateGestureConfig } from "../common/config-validation.js";
const DEFAULT_CONFIG_PATH = "config/gestures.json";
const logger = createLogger("GestureConfigLoader");
export class GestureConfigLoader {
    constructor() {
        this.defaultConfig = null;
        this.currentConfig = null;
    }
    // Loads configuration merging default with stored snapshot.
    async initialize() {
        const defaultConfig = await this.ensureDefaultConfig();
        const stored = await configStateService.read();
        if (stored) {
            logger.info(`Merging configuration from ${stored.source}`);
            const merged = this.merge(defaultConfig, stored.value);
            this.setCurrent(merged, stored.source);
            return merged;
        }
        logger.info("Using default configuration");
        this.setCurrent(defaultConfig, "default");
        return defaultConfig;
    }
    // Returns current configuration.
    getCurrent() {
        if (!this.currentConfig) {
            throw new Error("Configuration not initialized");
        }
        return this.currentConfig;
    }
    // Applies external configuration update.
    async applyUpdate(config) {
        const defaultConfig = await this.ensureDefaultConfig();
        const merged = this.merge(defaultConfig, config);
        this.setCurrent(merged, "sync");
        return merged;
    }
    async ensureDefaultConfig() {
        if (this.defaultConfig) {
            return this.defaultConfig;
        }
        const url = chrome.runtime.getURL(DEFAULT_CONFIG_PATH);
        logger.info("Loading default configuration", url);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load default configuration: ${response.status}`);
        }
        const json = (await response.json());
        const normalized = {
            defaultDelay: json.defaultDelay,
            minMoveDistance: json.minMoveDistance,
            gestures: json.gestures.map((gesture) => ({
                ...gesture,
                sequence: normalizeSequence(gesture.sequence)
            }))
        };
        validateGestureConfig(normalized);
        this.defaultConfig = normalized;
        return normalized;
    }
    merge(defaultConfig, override) {
        const normalized = {
            defaultDelay: override.defaultDelay,
            minMoveDistance: override.minMoveDistance,
            gestures: override.gestures.map((gesture) => ({
                ...gesture,
                sequence: normalizeSequence(gesture.sequence)
            }))
        };
        validateGestureConfig(normalized);
        return mergeGestureConfigs(defaultConfig, normalized);
    }
    setCurrent(config, source) {
        this.currentConfig = config;
        configStateService.setCache({ source, value: config });
    }
}
export const gestureConfigLoader = new GestureConfigLoader();
