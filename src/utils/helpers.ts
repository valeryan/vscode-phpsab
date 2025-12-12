import os from 'node:os';
import { ExtensionContext, extensions, window } from 'vscode';
import type {
  PHPCSArgumentKey,
  PHPCSInternalArgumentKey,
} from '../interfaces/arguments';
import {
  PHPCSArgumentValidation,
  validAdditionalArguments,
  validFlags,
  validInternalArguments,
} from '../interfaces/arguments';
import { ExtensionInfo } from '../interfaces/extensionInfo';
import { logger } from '../logger';
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
 * Validate and filter the additional arguments, ensuring they don't contain any malicious code.
 * @param {string[]} additionalArguments Array of additional arguments
 * @returns {string[]} Array of valid additional arguments, otherwise an empty array.
 */
const validateAdditionalArguments = (
  additionalArguments: string[],
): string[] => {
  // If no additional arguments are provided, return an empty array early (no need to continue).
  if (additionalArguments.length === 0) {
    return [];
  }

  // Set a variable with a default true value so we can test it later.
  let isArgValid: boolean = true;
  const argErrors: string[] = [];

  // Set a default warning message in case we need it later.
  let txt =
    'Some additional arguments were removed due to validation failure or they tried to overwrite internally-added arguments.';
  let warningMsg = txt;
  let logMsg = `${txt}\nThe supplied arguments were: "${additionalArguments.join(', ')}".`;

  // Filter the arguments.
  const filteredArguments = additionalArguments.filter((arg) => {
    // If the argument is an internally added argument, filter it out.
    if (validInternalArguments.includes(getArgumentKey(arg))) {
      isArgValid = false;
      return false;
    }

    // If we get here, the argument is not internally added, so we can continue to validate it.

    // Validate the argument.
    const { isValid, errors } = validateArgument(arg);

    // Set isArgValid to the result of the validation so we can
    // use it later outside this scope.
    isArgValid = isValid;

    // Collect any errors for logging later.
    argErrors.push(...errors);

    // Then filter it depending on it's validity.
    return isArgValid;
  });

  // If array is not empty (after filtering)...
  if (filteredArguments.length > 0) {
    // If any arguments were invalid, set some messages.
    if (!isArgValid) {
      txt = '\nRunning with the filtered arguments';
      logMsg += `${txt}: "${filteredArguments.join(', ')}".`;
    }
  }
  // If the filtered arguments array is empty, it means all arguments were invalid.
  else {
    txt = `\nRunning without additional arguments`;
    logMsg += `${txt}.`;
  }

  logMsg +=
    argErrors.length > 0 ? `\nErrors:\n- ${argErrors.join('\n- ')}` : '';

  warningMsg += `${txt}, for more details please see the Output channel.`;

  // If any arguments were invalid...
  if (!isArgValid) {
    // Log the warning messages and inform the user.
    logger.warn(logMsg);
    // Show a warning message to the user, and offer to open the output channel.
    window
      .showWarningMessage(warningMsg, 'OK', 'Open Output Channel')
      .then((selection) => {
        // If user chose to open output channel, then show it.
        if (selection === 'Open Output Channel') {
          logger.showChannel();
        }
      });
  }

  // Return the filtered array or an empty array.
  return filteredArguments ?? [];
};

/**
 * Parse command line arguments.
 * @param {string[]} args The command line arguments to parse.
 * @returns {string[]} The parsed arguments.
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

/**
 * Validates a PHPCS argument against the whitelist
 * @param {string} arg The argument to validate
 * @returns {PHPCSArgumentValidation} The validation result
 */
const validateArgument = (arg: string): PHPCSArgumentValidation => {
  const errors: string[] = [];

  // Validate that argument starts with a dash
  if (!arg.startsWith('-')) {
    return { isValid: false, errors: [`Invalid argument: "${arg}"`] };
  }

  // Handle key-value arguments
  if (arg.includes('=')) {
    return validateKeyValueArgument(arg, errors);
  }

  // Handle flag arguments (no value)
  if (!validFlags.includes(arg)) {
    errors.push(`Invalid flag argument: "${arg}"`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates key-value arguments (e.g., --severity=5)
 * @param {string} arg The argument to validate
 * @param {string[]} errors The array to collect error messages
 * @returns {PHPCSArgumentValidation} The validation result
 */
const validateKeyValueArgument = (
  arg: string,
  errors: string[],
): PHPCSArgumentValidation => {
  const [key, value] = arg.split('=', 2) as [PHPCSArgumentKey, string];

  if (!validAdditionalArguments.includes(key)) {
    return { isValid: false, errors: [`Invalid argument: "${arg}"`] };
  }

  // Validate specific argument values
  switch (key) {
    case '--filter':
      // Filter is either 'GitStaged', 'GitModified', or a path to a custom filter class.
      if (!validateFilterValue(value)) {
        errors.push(
          `Invalid argument value: "${value}". This must be either 'GitStaged', 'GitModified', or a valid file path.`,
        );
      }
      break;

    case '--ignore':
      // Ignore is a comma-separated list of glob patterns.
      if (!/^[a-zA-Z0-9.*/_\\,-]+$/.test(value)) {
        errors.push(
          `Invalid argument value: "${value}". This must be a comma-separated list of glob patterns.`,
        );
      }
      break;

    case '--severity':
    case '--error-severity':
    case '--warning-severity':
      // Validate severity levels, which are numeric 0-10
      if (!/^(0|[1-9]|10)$/.test(value)) {
        errors.push(`Invalid argument value: "${value}". This must be 0-10.`);
      }
      break;

    default:
      errors.push(`Invalid argument value: "${value}"`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates --filter argument values
 * @param {string} value The filter value to validate
 * @returns {boolean} Whether the filter value is valid
 */
const validateFilterValue = (value: string): boolean => {
  const isValidSpecialValue = value === 'GitStaged' || value === 'GitModified';
  const isValidFilePath = /^[a-zA-Z0-9._/\\: -]+$/.test(value);

  if (isValidSpecialValue || isValidFilePath) {
    return true;
  }

  return false;
};

/**
 * Extracts the argument key from a command line key-value argument.
 * @param {string} arg The argument (e.g., "--standard=PSR12" or "-q")
 * @returns {PHPCSInternalArgumentKey} The key part (e.g., "--standard" or "-q")
 */
const getArgumentKey = (arg: string): PHPCSInternalArgumentKey => {
  // If the argument contains an '=', split and return the key part.
  // Otherwise, return the argument as is.
  return (
    arg.includes('=') ? arg.split('=', 2)[0] : arg
  ) as PHPCSInternalArgumentKey;
};

/**
 * Constructs a command string from a command and an array of arguments.
 *
 * When using `shell: true` in spawn and spawnSync, Node v24+ deprecates passing args as an array
 * and now emits a warning message. So we need to concatenate the command and args into a single
 * command string instead.
 *
 * @see https://github.com/nodejs/node/pull/57199
 *
 * @param {string} command The command to execute.
 * @param {string[]} args The array of arguments to pass to the command.
 * @returns {string} The constructed command string.
 */
export const constructCommandString = (command: string, args: string[]) => {
  // Wrap command in quotes to handle spaces in paths.
  command = `"${command}"`;

  // Concatenate the command and the arguments together delimited by spaces.
  return `${command} ${args.join(' ')}`;
};

/**
 * Get the operating system-specific end-of-line marker.
 * @returns {string} The operating system-specific end-of-line marker. `\n` on POSIX and `\r\n` on Windows.
 */
export const getEOL = (): string => {
  return os.EOL;
};
