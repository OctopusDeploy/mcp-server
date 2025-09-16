import * as fs from "fs";
import * as path from "path";

export enum LogLevel {
  INFO = 1,
  ERROR = 2
}

interface LoggerConfig {
  logFilePath: string;
  minLevel: LogLevel;
  quietMode: boolean;
}

/**
 * Default logger configuration
 */
let config: LoggerConfig = {
  logFilePath: "mcp-server-log.txt",
  minLevel: LogLevel.INFO,
  quietMode: false
};

/**
 * Set custom log file path
 * @param filePath Path to the log file (can be full path or just filename)
 */
function setLogFilePath(filePath: string): void {
  // If it's just a filename (no path separators), use current directory
  if (!filePath.includes('/') && !filePath.includes('\\')) {
    config.logFilePath = path.join(process.cwd(), filePath);
  } else {
    config.logFilePath = filePath;
  }
}

/**
 * Set minimum log level
 * @param level Minimum log level to output
 */
function setLogLevel(level: LogLevel): void {
  config.minLevel = level;
}

/**
 * Set quiet mode (disables file logging, only console.error)
 * @param quiet Whether to enable quiet mode
 */
function setQuietMode(quiet: boolean): void {
  config.quietMode = quiet;
}

/**
 * Parse string log level to enum
 * @param levelStr String representation of log level
 * @returns LogLevel enum value
 */
function parseLogLevel(levelStr: string): LogLevel {
  const upperLevel = levelStr.toUpperCase();
  switch (upperLevel) {
    case 'INFO':
      return LogLevel.INFO;
    case 'ERROR':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}

/**
 * Get string representation of log level
 * @param level LogLevel enum value
 * @returns String representation
 */
function logLevelToString(level: LogLevel): string {
  switch (level) {
    case LogLevel.INFO:
      return 'INFO';
    case LogLevel.ERROR:
      return 'ERROR';
    default:
      return 'INFO';
  }
}

/**
 * Check if a log level should be output based on minimum level
 * @param level Level to check
 * @returns True if should log
 */
function shouldLog(level: LogLevel): boolean {
  return level >= config.minLevel;
}

/**
 * Write a log entry to file with timestamp
 * @param level Log level
 * @param message Message to log
 */
function writeToFile(level: LogLevel, message: string): void {
  if (config.quietMode) {
    return; // Don't write to file in quiet mode
  }

  const timestamp = new Date().toISOString();
  const levelStr = logLevelToString(level);
  const logEntry = `[${timestamp}] [${levelStr}] ${message}\n`;

  try {
    fs.appendFileSync(config.logFilePath, logEntry);
  } catch (error) {
    // If we can't write to file, at least try to output to console
    console.error(`Failed to write to log file: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Original log message: ${logEntry.trim()}`);
  }
}

/**
 * Log an info message to file only
 * @param message Message to log
 */
function info(message: string): void {
  if (!shouldLog(LogLevel.INFO)) return;
  writeToFile(LogLevel.INFO, message);
}

/**
 * Log an error message to both file and console.error
 * @param message Error message to log
 */
function error(message: string): void {
  if (!shouldLog(LogLevel.ERROR)) return;
  writeToFile(LogLevel.ERROR, message);
  console.error(message);
}

export const logger = {
  setLogFilePath,
  setLogLevel,
  setQuietMode,
  parseLogLevel,
  info,
  error
};