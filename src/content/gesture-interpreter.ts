import { createLogger } from "../common/log.js";
import type { Direction, GestureConfig, GestureDefinition, GestureMatch } from "../common/types.js";

const logger = createLogger("GestureInterpreter");

// Determines whether two sequences are equal.
const sequencesMatch = (expected: Direction[], actual: Direction[]) => {
  if (expected.length !== actual.length) {
    return false;
  }

  return expected.every((step, index) => step === actual[index]);
};

export class GestureInterpreter {
  private readonly configProvider: () => GestureConfig;

  // Creates interpreter bound to config provider.
  constructor(configProvider: () => GestureConfig) {
    this.configProvider = configProvider;
  }

  // Matches sequence against configuration.
  interpret(sequence: Direction[]): GestureMatch | null {
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

export const createGestureInterpreter = (configProvider: () => GestureConfig) =>
  new GestureInterpreter(configProvider);
