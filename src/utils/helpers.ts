import { getSystemErrorMap } from 'node:util';
import { ExtensionContext, extensions } from 'vscode';
import { ConsoleError } from '../interfaces/console-error';
import { ExtensionInfo } from '../interfaces/extensionInfo';
import { isWin } from '../resolvers/path-resolver-utils';

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

/**
 * Build the arguments needed to execute sniffer or fixer.
 * @param {string} filePath The file path to be linted or fixed. (Note: The path is obtained via vscode's API, so it's already normalized.)
 * @param {string} standard The coding standard to use.
 * @param {string[]} additionalArguments Any additional arguments to pass to the executable.
 * @param {string} toolType The type of tool being executed (e.g., 'sniffer', 'fixer').
 * @returns {string[]} The array of arguments to pass to the sniffer or fixer executable.
 */
export const getArgs = (
  filePath: string,
  standard: string,
  additionalArguments: string[],
  toolType: 'sniffer' | 'fixer',
): string[] => {
  let args = [];

  // If sniffer, we need to add the JSON report argument.
  if (toolType === 'sniffer') {
    args.push('--report=json');
  }

  // Quiet output - no errors or warnings.
  args.push('-q');

  // If a standard is set, add it to the args.
  if (standard !== '') {
    args.push(`--standard=${standard}`);
  }

  // Add the file path argument for stdin path resolution.
  args.push(`--stdin-path=${filePath}`);

  // Validate additional arguments.
  additionalArguments = validateAdditionalArguments(additionalArguments);

  // Append any additional arguments.
  args = args.concat(additionalArguments);

  // Indicate we will be passing the file contents via stdin.
  // This must be the last argument.
  args.push('-');

  return args;
};

/**
 * Validate the additional arguments.
 * @param {string[]} additionalArguments Array of additional arguments
 * @returns {string[]} Array of valid additional arguments, otherwise an empty array.
 */
const validateAdditionalArguments = (
  additionalArguments: string[],
): string[] => {
  // Filter out arguments that are added internally.
  additionalArguments = additionalArguments.filter((arg) => {
    if (
      arg.indexOf('--report') === -1 &&
      arg.indexOf('--standard') === -1 &&
      arg.indexOf('--stdin-path') === -1 &&
      arg !== '-q' &&
      arg !== '-'
    ) {
      return true;
    }

    return false;
  });

  // If array is not empty (after filtering), return the array.
  if (additionalArguments.length > 0) {
    return additionalArguments;
  }

  // Otherwise, return an empty array.
  return [];
};

/**
 * Parse command line arguments.
 * @param {string[]} args The command line arguments to parse.
 * @returns The parsed arguments.
 */
export const parseArgs = (args: string[]) => {
  const parsedArgs: string[] = [];

  // For each argument, wrap in quotes to allow spaces in paths
  // and to help prevent command injection.
  args.forEach((arg: string) => {
    // Windows...
    if (isWin()) {
      // Wrap in double quotes.
      // See https://ss64.com/nt/syntax-esc.html#quotes
      parsedArgs.push(`"${arg}"`);
    }
    // *nix...
    else {
      // Wrap in single quotes.
      // See https://ss64.com/bash/syntax-quoting.html
      parsedArgs.push(`'${arg}'`);
    }
  });

  return parsedArgs;
};
