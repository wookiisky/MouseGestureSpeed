import { configStateService } from "../common/config-state-service.js";
import { createLogger } from "../common/log.js";
import {
  mergeGestureConfigs,
  normalizeSequence,
  validateGestureConfig
} from "../common/config-validation.js";
import type { ConfigStateSnapshot, GestureConfig } from "../common/types.js";

const DEFAULT_CONFIG_PATH = "config/gestures.json";

const logger = createLogger("GestureConfigLoader");

export class GestureConfigLoader {
  private defaultConfig: GestureConfig | null = null;
  private currentConfig: GestureConfig | null = null;

  // Loads configuration merging default with stored snapshot.
  async initialize(): Promise<GestureConfig> {
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
  getCurrent(): GestureConfig {
    if (!this.currentConfig) {
      throw new Error("Configuration not initialized");
    }

    return this.currentConfig;
  }

  // Applies external configuration update.
  async applyUpdate(config: GestureConfig): Promise<GestureConfig> {
    const defaultConfig = await this.ensureDefaultConfig();
    const merged = this.merge(defaultConfig, config);
    this.setCurrent(merged, "sync");
    return merged;
  }

  private async ensureDefaultConfig(): Promise<GestureConfig> {
    if (this.defaultConfig) {
      return this.defaultConfig;
    }

    const url = chrome.runtime.getURL(DEFAULT_CONFIG_PATH);
    logger.info("Loading default configuration", url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load default configuration: ${response.status}`);
    }

    const json = (await response.json()) as GestureConfig;
    const normalized: GestureConfig = {
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

  private merge(defaultConfig: GestureConfig, override: GestureConfig): GestureConfig {
    const normalized: GestureConfig = {
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

  private setCurrent(config: GestureConfig, source: ConfigStateSnapshot["source"]) {
    this.currentConfig = config;
    configStateService.setCache({ source, value: config });
  }
}

export const gestureConfigLoader = new GestureConfigLoader();
