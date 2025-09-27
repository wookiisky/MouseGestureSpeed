let currentLevel = "info";
// Sets global log level.
export const setLogLevel = (level) => {
    currentLevel = level;
};
// Returns current log level.
export const getLogLevel = () => currentLevel;
// Creates a logger scoped by module id.
export const createLogger = (moduleId) => {
    // Formats message with module prefix.
    const format = (message) => `[${moduleId}] ${message}`;
    return {
        info: (message, ...args) => {
            if (currentLevel === "info") {
                console.log(format(message), ...args);
            }
        },
        error: (message, ...args) => {
            if (currentLevel === "info" || currentLevel === "error") {
                console.error(format(message), ...args);
            }
        }
    };
};
