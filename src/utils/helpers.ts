import { getSystemErrorMap } from 'node:util';
import { ExtensionContext, extensions } from 'vscode';
import { ConsoleError } from '../interfaces/console-error';
import { ExtensionInfo } from '../interfaces/extensionInfo';

const extensionInfo: ExtensionInfo = {} as ExtensionInfo;

export const setExtensionInfo = (context: ExtensionContext) => {
  // Get extension unique identifier from context
  const id = context.extension.id;
  const packageJSON = extensions.getExtension(id)?.packageJSON;

  extensionInfo.id = id;
  extensionInfo.displayName = packageJSON?.displayName;
  extensionInfo.version = packageJSON?.version;
};

export const getExtensionInfo = (): ExtensionInfo => {
  return extensionInfo;
};

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

  let errorName = '';
  let errorDescription = '';

  // Search through the error map to find the error by name
  for (const [name, description] of errorMap) {
    if (name === code) {
      errorDescription = description;
      break;
    }
  }

  // Timeout error
  if (code === 'ETIMEDOUT') {
    errorMsg += `The ${toolType} process timed out `;
  }
  // Path/file not found error
  else if (code === 'ENOENT') {
    errorMsg += `The path "${nodeError.path}" was not found `;
  }
  // Handle other error codes we may not be aware of
  errorMsg += `[${code} ${errorDescription}].\n\n`;

  // Add extra information for debugging for logger only.
  let extraLoggerMsg = `Internal message: ${nodeError.message}.\n\n`;

  // Append stack trace and cause if available.
  extraLoggerMsg += nodeError.stack
    ? `[Stack trace]: ${nodeError.stack}\n`
    : '';
  extraLoggerMsg += nodeError.cause ? `\n[Caused by]: ${nodeError.cause}` : '';

  return { errorMsg, extraLoggerMsg };
};
