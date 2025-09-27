import { createLogger } from "../common/log.js";
const logger = createLogger("GestureInterpreter");
// Determines whether two sequences are equal.
const sequencesMatch = (expected, actual) => {
    if (expected.length !== actual.length) {
        return false;
    }
    return expected.every((step, index) => step === actual[index]);
};
export class GestureInterpreter {
    // Creates interpreter bound to config provider.
    constructor(configProvider) {
        this.configProvider = configProvider;
    }
    // Matches sequence against configuration.
    interpret(sequence) {
        const config = this.configProvider();
        logger.info("Interpreting gesture", sequence);
        for (const definition of config.gestures) {
            if (sequencesMatch(definition.sequence, sequence)) {
                logger.info(`Gesture matched action=${definition.action}`);
                return { action: definition.action, definition };
            }
        }
        logger.info("No gesture definition matched");
        return null;
    }
}
export const createGestureInterpreter = (configProvider) => new GestureInterpreter(configProvider);
