import { OutputChannel, window } from 'vscode';
import { getExtensionInfo } from './utils/helpers';

let outputChannel: OutputChannel;

let debugMode = true; // Set debug mode to true by default

const startTime: {
  [key: string]: Date;
} = {};

/**
 * Override the output channel
 * @param channel A vscode output channel
 */
export const setupOutputChannel = (channelOverride?: OutputChannel): void => {
  if (channelOverride) {
    outputChannel = channelOverride;
    return;
  }
  const { displayName } = getExtensionInfo();

  outputChannel = window.createOutputChannel(displayName);
};

/**
 * Turn debug mode on or off. Off will disable info and debug messages
 * @param debug boolean
 */
export const setDebugMode = (debug: boolean): void => {
  debugMode = debug;
};

/**
 * Allow the extension to cleanup output channel
 */
export const disposeLogger = (): void => {
  outputChannel.dispose();
};

/**
 * Sends a basic info log to the output channel if debug is enabled.
 * @param message the message to be logged
 */
export const info = (message: string): void => {
  if (debugMode) {
    logMessage('INFO', message);
  }
};

/**
 * Sends a log message and a data to the output channel if debug is enabled.
 * This method purpose is for logging data object.
 * @param message the message to be logged
 * @param data [optional] extra data that is useful for debugging
 */
export const debug = (message: string, data?: unknown): void => {
  if (debugMode) {
    logMessage('DEBUG', message, data);
  }
};

/**
 * Send a basic info log to output channel
 * @param message string to be logged
 */
export const log = (message: string): void => {
  logMessage('INFO', message);
};

/**
 * Send a basic warning log to output channel
 * @param message string to be logged
 */
export const warn = (message: string): void => {
  logMessage('WARNING', message);
};

/**
 * Send a error message and a stack trace if available
 * @param message string to be logged
 * @param error Error an Error object
 */
export const error = (message: string, error?: Error): void => {
  logMessage('ERROR', message, error);
};

/**
 * Start a timer to track performance.
 * @param key identifier for timer
 */
export const startTimer = (key: string): void => {
  startTime[key] = new Date();
  info(`${key} running...`);

  // Schedule check for expiration
  setTimeout(() => {
    checkTimer(key);
  }, 60 * 1000);
};

/**
 * Calculate time passed and log results.
 * @param key identifier for timer
 */
export const endTimer = (key: string): void => {
  const endTime = new Date();
  const startTimeValue = startTime[key];

  if (!startTimeValue) {
    info(`${key} timer was not started.`);
    // Unset timer
    delete startTime[key];
    return;
  }

  const timeDiff = endTime.valueOf() - startTime[key].valueOf();
  // strip the ms
  const seconds = timeDiff / 1000;
  info(`${key} ran for ${seconds} seconds`);
  // Unset timer
  delete startTime[key];
};

/**
 * Check and cleanup timers that have expired.
 * @param key identifier for timer
 * @returns void
 */
const checkTimer = (key: string): void => {
  const startTimeValue = startTime[key];

  if (!startTimeValue) {
    // jobs done, timer is not set.
    return;
  }
  info(`${key} operation timed out.`);
  delete startTime[key];
};

/**
 * Format the message and send to output channel.
 * @param level Log Level of message
 * @param message the message to be logged
 * @param meta extra data as needed
 */
const logMessage = (level: string, message: string, meta?: unknown) => {
  if (!outputChannel) {
    setupOutputChannel();
  }
  const time = new Date().toLocaleTimeString();
  outputChannel.appendLine(`["${level}" - ${time}] ${message}`);

  if (meta) {
    const message = JSON.stringify(meta, null, 2).trim();
    outputChannel.appendLine(message);
  }
};

/**
 * Show the output channel to the user.
 */
const showChannel = () => {
  if (outputChannel) {
    outputChannel.show();
  }
};

export const logger = {
  log,
  info,
  debug,
  warn,
  error,
  startTimer,
  endTimer,
  setDebugMode,
  setupOutputChannel,
  showChannel,
};
