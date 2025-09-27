import type { Direction, GestureAction, GestureConfig, GestureDefinition } from "./types.js";

export const VALID_DIRECTIONS: Direction[] = [
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "RIGHT_BUTTON",
  "LEFT_CLICK"
];

export const VALID_ACTIONS: GestureAction[] = [
  "NAVIGATE_BACK",
  "NAVIGATE_FORWARD",
  "SCROLL_TOP",
  "SCROLL_BOTTOM",
  "RELOAD",
  "CLOSE_TAB"
];

// Normalizes string directions to enums.
export const normalizeSequence = (sequence: Array<string | Direction>): Direction[] => {
  // Normalize tokens and remove RIGHT_BUTTON as right-button hold is implicit.
  const normalized = sequence.map((item) => String(item).toUpperCase().trim() as Direction);
  return normalized.filter((token) => token !== "RIGHT_BUTTON");
};

// Validates single gesture definition.
export const validateGestureDefinition = (gesture: GestureDefinition) => {
  if (!Array.isArray(gesture.sequence) || gesture.sequence.length === 0) {
    throw new Error("Gesture sequence must be a non-empty array");
  }

  for (const direction of gesture.sequence) {
    if (!VALID_DIRECTIONS.includes(direction)) {
      throw new Error(`Unsupported direction ${direction}`);
    }
  }

  if (!VALID_ACTIONS.includes(gesture.action)) {
    throw new Error(`Unsupported action ${gesture.action}`);
  }
};

// Validates entire gesture configuration.
export const validateGestureConfig = (config: GestureConfig) => {
  if (typeof config.defaultDelay !== "number" || config.defaultDelay < 0) {
    throw new Error("Invalid defaultDelay value");
  }

  if (typeof config.minMoveDistance !== "number" || config.minMoveDistance <= 0) {
    throw new Error("Invalid minMoveDistance value");
  }

  if (!Array.isArray(config.gestures)) {
    throw new Error("Gestures must be an array");
  }

  config.gestures.forEach(validateGestureDefinition);
};

// Merges default and override configurations.
export const mergeGestureConfigs = (baseConfig: GestureConfig, override: GestureConfig): GestureConfig => {
  const overrideMap = new Map<string, GestureDefinition>();

  for (const gesture of override.gestures) {
    const key = gesture.sequence.join(">");
    overrideMap.set(key, gesture);
  }

  const mergedGestures: GestureDefinition[] = [];
  const seen = new Set<string>();

  for (const gesture of baseConfig.gestures) {
    const key = gesture.sequence.join(">");
    if (overrideMap.has(key)) {
      mergedGestures.push(overrideMap.get(key)!);
      seen.add(key);
    } else {
      mergedGestures.push({ ...gesture, sequence: [...gesture.sequence] });
    }
  }

  for (const [key, gesture] of overrideMap.entries()) {
    if (!seen.has(key)) {
      mergedGestures.push(gesture);
    }
  }

  return {
    defaultDelay: override.defaultDelay ?? baseConfig.defaultDelay,
    minMoveDistance: override.minMoveDistance ?? baseConfig.minMoveDistance,
    gestures: mergedGestures
  };
};
