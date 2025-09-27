export type LogLevel = "silent" | "error" | "info";

type Logger = {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

let currentLevel: LogLevel = "info";

// Sets global log level.
export const setLogLevel = (level: LogLevel) => {
  currentLevel = level;
};

// Returns current log level.
export const getLogLevel = (): LogLevel => currentLevel;

// Creates a logger scoped by module id.
export const createLogger = (moduleId: string): Logger => {
  // Formats message with module prefix.
  const format = (message: string) => `[${moduleId}] ${message}`;

  return {
    info: (message: string, ...args: unknown[]) => {
      if (currentLevel === "info") {
        console.log(format(message), ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      if (currentLevel === "info" || currentLevel === "error") {
        console.error(format(message), ...args);
      }
    }
  };
};
