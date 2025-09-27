export type LogLevel = "silent" | "error" | "warn" | "info";

type Logger = {
  // Logs informational messages.
  info: (message: string, ...args: unknown[]) => void;
  // Logs warning messages.
  warn: (message: string, ...args: unknown[]) => void;
  // Logs error messages.
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
    // Logs info when level is info.
    info: (message: string, ...args: unknown[]) => {
      if (currentLevel === "info") {
        console.log(format(message), ...args);
      }
    },
    // Logs warn when level is warn or info.
    warn: (message: string, ...args: unknown[]) => {
      if (currentLevel === "info" || currentLevel === "warn") {
        console.warn(format(message), ...args);
      }
    },
    // Logs error when level is error, warn, or info.
    error: (message: string, ...args: unknown[]) => {
      if (currentLevel !== "silent") {
        console.error(format(message), ...args);
      }
    }
  };
};
