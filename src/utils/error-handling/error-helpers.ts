import { getSystemErrorMap } from 'node:util';
import { ConsoleError } from '../../interfaces/console-error';

/**
 * Determine the Node error and return a formatted string of the error message(s) and stack trace.
 * @param {ConsoleError} nodeError The Node error object.
 * @param {string} toolType The type of tool being executed (e.g., 'sniffer', 'fixer').
 * @returns {{ errorMsg: string; extraLoggerMsg: string }} The formatted error message for user notification and extra info for logging like stack trace.
 */
export const determineNodeError = (
  nodeError: ConsoleError,
  toolType: 'sniffer' | 'fixer',
): { errorMsg: string; extraLoggerMsg: string } => {
  let errorMsg = `${toolType.toUpperCase()} NODE ERROR: `;
  // Assert code is not undefined.
  const code = nodeError.code!;

  // Timeout error
  if (code === 'ETIMEDOUT') {
    errorMsg += `The ${toolType} process timed out `;
  }
  // Path/file not found error
  else if (code === 'ENOENT') {
    errorMsg += `The path "${nodeError.path}" was not found `;
  }
  // Handle other error codes we may not be aware of
  errorMsg += `[${code} ${getErrorCodeDescription(code)}].\n\n`;

  // Add extra information for debugging for logger only.
  let extraLoggerMsg = `Internal message: ${nodeError.message}.\n\n`;

  // Append stack trace and cause if available.
  extraLoggerMsg += nodeError.stack
    ? `[Stack trace]: ${nodeError.stack}\n`
    : '';
  extraLoggerMsg += nodeError.cause ? `\n[Caused by]: ${nodeError.cause}` : '';

  return { errorMsg, extraLoggerMsg };
};

/**
 * Get a description for a given error code.
 * @param {string} code The error code string.
 * @returns {string} Description of the error code.
 */
export const getErrorCodeDescription = (code: string): string => {
  // Node.js specific errors (ERR_* codes)
  const nodeErrorMessages: { [key: string]: string } = {
    ERR_OPERATION_FAILED: 'A general script execution error occurred.',
  };

  // System errors (e.g. ENOENT, EACCES, etc)
  const nodeSystemMessages = getSystemErrorMap().values();

  // Merge the two together to make searching easier.
  const errorMap = [
    ...nodeSystemMessages,
    ...Object.entries(nodeErrorMessages),
  ];

  // Search through the error map to find the error by name
  for (const [name, description] of errorMap) {
    if (name === code) {
      return description;
    }
  }

  return 'Unknown error occurred';
};

/**
 * Get the regex to match the error message when the `php` command is not found.
 *
 * ---
 *
 * Note:
 *
 * The regex is designed to match the various different OS and shell error messages
 * that indicate the `php` command is not found.
 * The regex is flexible to accommodate some of the most common formats of "command not found"
 * errors. But there may be some edge cases where some OS and shells may
 * have different formats than those described here. Those edge cases should be added to the
 * regex as and when they occur.
 *
 * The final regex will match an error message in part or in whole, and
 * with or without single or double quotes around `php`, and with or without a colon.
 *
 * The command error formats (without quotes) are as follows:
 *
 * 1. php is not recognized
 * 2. php: command not found
 * 3. php cannot be found
 * 4. command not found: php
 * 5. Unknown command php
 *
 * The final regex can be seen in action here: https://regex101.com/r/Ob1YKB
 */
export const getPhpNotFoundRegex = (): RegExp => {
  // Match 'php' with optional quotes
  const php = `["']?php["']?`;

  // Match optional colon and/or whitespace separators
  const separator = `[:\\s]*`;

  // Error message patterns that indicate php command is not found
  const errorPatterns = [
    'is\\s+not\\s+recognized',
    'command\\s+not\\s+found',
    'cannot\\s+be\\s+found',
    'unknown\\s+command',
    'no\\s+such\\s+file\\s+or\\s+directory',
  ];

  // Join error patterns into a single group.
  const error = `(${errorPatterns.join(`|`)})`;
  // Build regex to match php before error OR php after error.
  const pattern = `(${php}${separator})?${error}(${separator}${php})?`;

  const regex = new RegExp(pattern, 'i');

  return regex;
};
