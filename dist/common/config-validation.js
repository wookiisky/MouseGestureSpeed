export const VALID_DIRECTIONS = [
    "UP",
    "DOWN",
    "LEFT",
    "RIGHT",
    "RIGHT_BUTTON",
    "LEFT_CLICK"
];
export const VALID_ACTIONS = [
    "NAVIGATE_BACK",
    "NAVIGATE_FORWARD",
    "SCROLL_TOP",
    "SCROLL_BOTTOM",
    "RELOAD",
    "CLOSE_TAB"
];
// Normalizes string directions to enums.
export const normalizeSequence = (sequence) => {
    return sequence.map((item) => String(item).toUpperCase().trim());
};
// Validates single gesture definition.
export const validateGestureDefinition = (gesture) => {
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
export const validateGestureConfig = (config) => {
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
export const mergeGestureConfigs = (baseConfig, override) => {
    const overrideMap = new Map();
    for (const gesture of override.gestures) {
        const key = gesture.sequence.join(">");
        overrideMap.set(key, gesture);
    }
    const mergedGestures = [];
    const seen = new Set();
    for (const gesture of baseConfig.gestures) {
        const key = gesture.sequence.join(">");
        if (overrideMap.has(key)) {
            mergedGestures.push(overrideMap.get(key));
            seen.add(key);
        }
        else {
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
