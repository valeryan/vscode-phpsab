import { spawnSync, SpawnSyncOptions } from 'node:child_process';
import {
  ConfigurationChangeEvent,
  Disposable,
  Position,
  ProviderResult,
  Range,
  TextDocument,
  TextEdit,
  window,
  workspace,
} from 'vscode';
import { OriginalCommand } from './interfaces/common';
import { ConsoleError } from './interfaces/console-error';
import { Settings } from './interfaces/settings';
import { logger } from './logger';
import { createStandardsPathResolver } from './resolvers/standards-path-resolver';
import { loadSettings } from './settings';
import {
  determineNodeError,
  getPhpNotFoundRegex,
} from './utils/error-handling/error-helpers';
import { addWindowsEnoentError } from './utils/error-handling/windows-enoent-error';
import {
  constructCommandString,
  getArgs,
  getEOL,
  parseArgs,
  shouldProcess,
} from './utils/helpers';

let settingsCache: Settings;

/**
 * Get the current cached settings, loading them if necessary.
 * @returns {Promise<Settings>} A promise that resolves to the current settings.
 */
const getSettings = async (): Promise<Settings> => {
  if (!settingsCache) {
    settingsCache = await loadSettings();
  }
  return settingsCache;
};

/**
 * Reload and recache configuration settings when the relevant editor configuration changes.
 * @param {ConfigurationChangeEvent} event The configuration change event that triggered the reload.
 * @returns {Promise<void>} A void promise that resolves once the settings have been reloaded.
 */
const reloadSettings = async (
  event: ConfigurationChangeEvent,
): Promise<void> => {
  if (
    !event.affectsConfiguration('phpsab') &&
    !event.affectsConfiguration('php')
  ) {
    return;
  }
  settingsCache = await loadSettings();
};

/**
 * Get the document range
 * @param {TextDocument} document TextDocument
 * @returns {Range} The full range of the document.
 */
const documentFullRange = (document: TextDocument) =>
  new Range(
    new Position(0, 0),
    document.lineAt(document.lineCount - 1).range.end,
  );

/**
 * Check if the given range covers the entire document.
 * @param {Range} range The range to check.
 * @param {TextDocument} document he text document containing the range.
 * @returns {boolean} True if the range covers the entire document, false otherwise.
 */
const isFullDocumentRange = (range: Range, document: TextDocument) =>
  range.isEqual(documentFullRange(document));

/**
 * Run the fixer process and format the document.
 * @param {TextDocument} document The text document to format.
 * @param {boolean} fullDocument Whether to format the full document.
 * @returns {Promise<string>} A promise that resolves to the formatted document text.
 */
const format = async (
  document: TextDocument,
  fullDocument: boolean,
): Promise<string> => {
  const settings = await getSettings();
  const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

  const resourceConf = settings.resources[workspaceFolder?.index ?? 0];

  // If the document should not be processed, return early.
  if (shouldProcess(document, resourceConf, 'fixer') === false) {
    // Only show information dialog if fixer is disabled.
    // (We don't want to spam users if it's not a PHP file or if it's excluded via glob patterns.)
    if (resourceConf.fixerEnable === false) {
      window.showInformationMessage(
        'Fixer is disabled for this workspace or PHPCBF was not found for this workspace.',
      );
    }

    return '';
  }

  logger.startTimer('Fixer');

  // setup and spawn fixer process

  let standard: string;

  try {
    standard = await createStandardsPathResolver(
      document,
      resourceConf,
    ).resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    window.showErrorMessage(errorMessage, 'OK');
    logger.error(errorMessage);

    return '';
  }

  const lintArgs = getArgs(
    document.fileName,
    standard,
    resourceConf.fixerArguments,
    'fixer',
  );

  let fileText = document.getText();

  const options: SpawnSyncOptions = {
    cwd:
      resourceConf.workspaceRoot !== null
        ? resourceConf.workspaceRoot
        : undefined,
    env: process.env,
    encoding: 'utf8',
    input: fileText,
    // Required to prevent EINVAL errors when spawning .bat files on Windows.
    // https://github.com/valeryan/vscode-phpsab/issues/128
    // https://github.com/nodejs/node/issues/52554
    shell: true,
  };

  const CBFExecutable = resourceConf.executablePathCBF;
  const parsedArgs = parseArgs(lintArgs);

  const command = constructCommandString(CBFExecutable, parsedArgs);

  logger.info(`FIXER COMMAND: ${command}`);

  const fixer = spawnSync(command, options);

  const exitcode = fixer.status;
  const stdout = fixer.stdout.toString();
  const stderr = fixer.stderr.toString();

  // Set the original command information (not parsed) for Windows ENOENT error handling
  const originalCommand: OriginalCommand = {
    commandPath: CBFExecutable,
    args: lintArgs,
  };

  const nodeError =
    (fixer.error as ConsoleError) ||
    addWindowsEnoentError(fixer, originalCommand, 'spawnSync');

  logger.info(`FIXER EXIT CODE: ${exitcode}`);

  // We only log STDOUT if it starts with ERROR (3.x versions of phpcbf output "ERROR"
  // messages to stdout), as otherwise it could be the whole file contents,
  // which clutters the log when debugging.
  //
  // This will be removed once we require phpcbf 4.x, which outputs errors to STDERR.
  if (stdout && (stdout.startsWith('ERROR') || stdout.startsWith(getEOL()))) {
    logger.info(`FIXER STDOUT: ${stdout.trim()}`);
  }

  if (stderr) {
    logger.error(`FIXER STDERR: ${stderr.trim()}`);
  }

  let fixed = stdout;

  let errors: { [key: number]: string } = {
    3: 'FIXER: A general script execution error occurred.',
    16: 'FIXER: Configuration error of the application.',
    32: 'FIXER: Configuration error of a Fixer.',
    64: 'FIXER: Exception raised within the application.',
    255: 'FIXER: A Fatal execution error occurred.',
  };

  let error: string = '';
  let result: string = '';
  let message: string = '';
  let errorMsg: string = '';
  let extraLoggerMsg: string = '';

  // Test the regex against the stderr output.
  //
  // If fixer returns with stderr as the error "php is not recognized" or equivalent,
  // then show an error message to the user because PHP is not on the system's environment path.
  if (getPhpNotFoundRegex().test(stderr)) {
    error = `Please add PHP to your system's environment path, or use the extension setting "phpExecutablePath". - PHPCBF error: ${stderr}`;

    window.showErrorMessage(error, 'OK');
    return '';
  }

  /**
   * fixer exit codes:
   * Exit code 0 is used to indicate that no fixable errors were found, so nothing was fixed
   * Exit code 1 is used to indicate that all fixable errors were fixed correctly
   * Exit code 2 is used to indicate that FIXER failed to fix some of the fixable errors it found
   * Exit code 3 is used for general script execution errors
   */
  switch (exitcode) {
    case null: {
      if (!nodeError) {
        return '';
      }

      // Deal with Node errors.
      // Destructure the returned object and assign to variables.
      ({ errorMsg, extraLoggerMsg } = determineNodeError(nodeError, 'fixer'));
      error += errorMsg;

      break;
    }
    case 0:
    case 1: {
      // No fixable errors were found; OR
      // all errors were fixed successfully.

      // If stdout has valid fixed output (and doesn't contain error messages),
      // then this exit code indicates that all fixable errors were fixed.
      if (hasValidFixedOutput(stdout, fileText)) {
        result = fixed;
        message = 'All fixable errors were fixed correctly.';
      }
      // If Node errors.
      else if (nodeError) {
        // Destructure the returned object and assign to variables.
        ({ errorMsg, extraLoggerMsg } = determineNodeError(nodeError, 'fixer'));
        error += errorMsg;
      }
      // Otherwise, there were no fixable errors found.
      else {
        message = 'No fixable errors were found.';
      }

      break;
    }
    case 2: {
      // If stdout has valid fixed output (and doesn't contain error messages),
      // then this exit code indicates that some fixable errors failed to be fixed.
      if (hasValidFixedOutput(stdout, fileText)) {
        result = fixed;
        message = 'FIXER failed to fix some of the fixable errors.';
      }
      // If Node errors.
      else if (nodeError) {
        // Destructure the returned object and assign to variables.
        ({ errorMsg, extraLoggerMsg } = determineNodeError(nodeError, 'fixer'));
        error += errorMsg;
      }

      break;
    }
    default:
      // A PHPCBF error occurred.
      error =
        errors[exitcode] ||
        `FIXER: An unknown error occurred with exit code ${exitcode}.`;
      if (fixed.length > 0) {
        error += '\n' + fixed + '\n';
      }
      // Other errors.
      else {
        // If Node errors.
        if (nodeError) {
          // Destructure the returned object and assign to variables.
          ({ errorMsg, extraLoggerMsg } = determineNodeError(
            nodeError,
            'fixer',
          ));
          error += errorMsg;
        }
        // If no specific error is found, return a generic fatal error.
        else {
          error += 'FATAL: Unknown error occurred.';
        }
      }
  }

  logger.endTimer('Fixer');

  window.showInformationMessage(message);

  if (error !== '') {
    logger.error(`${error}${extraLoggerMsg}`);
    return Promise.reject(error);
  } else {
    logger.info(`FIXER MESSAGE: ${message}`);
  }

  return result;
};

/**
 * Check if the fixer output represents successfully fixed code
 *
 * It checks if the output is valid by ensuring:
 * - it's length is greater than 0; AND
 * - is different to the input file text; AND
 * - it doesn't start with a newline (EOL) character (all stdout errors start with a newline).
 *
 * @param {string} stdout The raw stdout (for EOL checking)
 * @param {string} originalFileText The original file text
 * @returns {boolean} boolean indicating if fixes were successfully applied
 */
const hasValidFixedOutput = (
  stdout: string,
  originalFileText: string,
): boolean => {
  return (
    stdout.length > 0 &&
    stdout !== originalFileText &&
    !stdout.startsWith(getEOL())
  );
};

/**
 * Activate the fixer and register the configuration change event listener.
 * @param {Disposable[]} subscriptions Disposable array
 * @param {Settings} settings Extension settings
 */
export const activateFixer = (
  subscriptions: Disposable[],
  settings: Settings,
) => {
  settingsCache = settings;
  workspace.onDidChangeConfiguration(reloadSettings, null, subscriptions);
};

/**
 * Setup wrapper to format for extension
 * @param {TextDocument} document The text document to format.
 * @param {Range} range The range within the document to format.
 * @returns {ProviderResult<TextEdit[]>} The text edits to apply to the document.
 */
export const registerFixerAsDocumentProvider = (
  document: TextDocument,
  range: Range,
): ProviderResult<TextEdit[]> => {
  return new Promise((resolve, reject) => {
    const fullRange = documentFullRange(document);
    const isFullDocument = isFullDocumentRange(range, document);

    format(document, isFullDocument)
      .then((text) => {
        if (text.length > 0) {
          // Edit the document with the fixes.
          return resolve([new TextEdit(fullRange, text)]);
        } else {
          // Nothing to fix.
          return resolve([]);
        }
      })
      .catch((err) => {
        window.showErrorMessage(err, 'OK');
        return reject(err);
      });
  });
};
