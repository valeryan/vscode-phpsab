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
import { ConsoleError } from '../interfaces/consoleError';
import { Settings } from '../interfaces/settings';
import { addPhpToEnvPath } from '../resolvers/pathResolverUtils';
import { createStandardsPathResolver } from '../resolvers/standardsPathResolver';
import { determineNodeError, getPhpNotFoundRegex } from '../utils/error-handling/error-helpers';
import { addWindowsEnoentError } from '../utils/error-handling/windows-enoent-error';
import { constructCommandString, getArgs, parseArgs } from '../utils/helpers';
import { logger } from './logger';
import { loadSettings } from './settings';

let settingsCache: Settings;

const getSettings = async () => {
  if (!settingsCache) {
    settingsCache = await loadSettings();
  }
  return settingsCache;
};

/**
 * Load Configuration from editor
 */
const reloadSettings = async (event: ConfigurationChangeEvent) => {
  if (!event.affectsConfiguration('phpsab')) {
    return;
  }
  settingsCache = await loadSettings();
};

/**
 * Get the document range
 * @param document TextDocument
 * @returns Range
 */
const documentFullRange = (document: TextDocument) =>
  new Range(
    new Position(0, 0),
    document.lineAt(document.lineCount - 1).range.end,
  );

/**
 * run the fixer process
 * @param document
 */
const format = async (document: TextDocument) => {
  const settings = await getSettings();
  const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    return '';
  }
  const resourceConf = settings.workspaces[workspaceFolder.index];
  if (document.languageId !== 'php') {
    return '';
  }

  if (resourceConf.fixerEnable === false) {
    const message =
      'Fixer is disable for this workspace or PHPCBF was not found.';
    logger.info(message);
    if (settings.debug) {
      window.showInformationMessage(message);
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
  } catch (error: any) {
    window.showErrorMessage(error.message, 'OK');
    logger.error(error.message);

    return '';
  }

  const lintArgs = getArgs(
    document.fileName,
    standard,
    resourceConf.fixerArguments,
    'fixer',
  );

  let fileText = document.getText();

  if (settings.phpExecutablePath != '') {
    addPhpToEnvPath(settings.phpExecutablePath);
  }

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

  const CBFExecutable = resourceConf.fixerExecutablePath;
  const parsedArgs = parseArgs(lintArgs);

  const command = constructCommandString(CBFExecutable, parsedArgs);

  logger.info(`FIXER COMMAND: ${command}`);

  const fixer = spawnSync(command, options);

  const exitcode = fixer.status;
  const stdout = fixer.stdout.toString();
  const stderr = fixer.stderr.toString();

  // Set the original command information (not parsed) for Windows ENOENT error handling
  const originalCommand = {
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
  if (stdout && stdout.startsWith('ERROR')) {
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

  let error: string | null = '';
  let result: string = '';
  let message: string = 'No fixable errors were found.';
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
    case 1: {
      if (fixed.length > 0 && fixed !== fileText) {
        result = fixed;
        message = 'All fixable errors were fixed correctly.';
      }
      // If Node errors.
      else if (nodeError) {
        // Destructure the returned object and assign to variables.
        ({ errorMsg, extraLoggerMsg } = determineNodeError(nodeError, 'fixer'));
        error += errorMsg;
      }

      break;
    }
    case 2: {
      if (fixed.length > 0 && fixed !== fileText) {
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
      error = errors[exitcode];
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
 * Load settings and register event watcher
 * @param subscriptions Disposable array
 * @param settings Extension settings
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
 * @param document
 */
export const registerFixerAsDocumentProvider = (
  document: TextDocument,
): ProviderResult<TextEdit[]> => {
  return new Promise((resolve, reject) => {
    const fullRange = documentFullRange(document);

    format(document)
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
