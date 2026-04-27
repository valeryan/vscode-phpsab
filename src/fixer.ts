import crossSpawn from 'cross-spawn';
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
import { ConsoleError } from './interfaces/console-error';
import { ResourceSettings } from './interfaces/resource-settings';
import { Settings } from './interfaces/settings';
import { logger } from './logger';
import { toContainerPath } from './resolvers/docker-path-resolver';
import { createStandardsPathResolver } from './resolvers/standards-path-resolver';
import { loadSettings } from './settings';
import { remapStandardForContainer } from './utils/docker-standard';
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

type FixerCommand = {
  commandPath: string;
  commandArgs: string[];
  command: string;
  runThroughShell: boolean;
};

const getSettings = () => {
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
 *
 * @param range Range
 * @param document TextDocument
 * @returns boolean
 */
const isFullDocumentRange = (range: Range, document: TextDocument) =>
  range.isEqual(documentFullRange(document));

/**
 * run the fixer process
 * @param document
 */
const format = async (document: TextDocument, fullDocument: boolean) => {
  const settings = getSettings();
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
  } catch (error: any) {
    window.showErrorMessage(error.message, 'OK');
    logger.error(error.message);

    return '';
  }

  if (resourceConf.dockerEnabled) {
    standard = await remapStandardForContainer(standard, resourceConf);
  }

  // Path passed to phpcbf as --stdin-path. The fixer always uses stdin mode
  // because file mode does not return fixed content on stdout.
  const filePath = resourceConf.dockerEnabled
    ? toContainerPath(
        document.fileName,
        resourceConf.workspaceRoot ?? '',
        resourceConf.dockerWorkspaceRoot,
      )
    : document.fileName;

  const lintArgs = getArgs(
    filePath,
    standard,
    resourceConf.fixerArguments,
    'fixer',
    false,
  );

  let fileText = document.getText();

  const { commandPath, commandArgs, command, runThroughShell } =
    buildFixerCommand(resourceConf, lintArgs);

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
    // Local execution keeps shell mode for .bat/wrapper compatibility.
    // Docker execution uses cross-spawn without shell to avoid the extra
    // cmd.exe layer on Windows.
    shell: runThroughShell,
  };

  logger.info(`FIXER COMMAND: ${command}`);

  const fixer = runThroughShell
    ? spawnSync(command, options)
    : crossSpawn.sync(commandPath, commandArgs, options);

  const exitcode = fixer.status;
  const stdout = fixer.stdout.toString();
  const stderr = fixer.stderr.toString();

  // Set the original command information (not parsed) for Windows ENOENT error handling
  const originalCommand = {
    commandPath,
    args: commandArgs,
  };

  // The hand-rolled ENOENT heuristic only applies when CMD is in the loop
  // (shell: true) — CMD swallows ENOENT and exits 1. On the cross-spawn /
  // no-shell path Node populates `fixer.error` with a real ENOENT directly.
  const nodeError =
    (fixer.error as ConsoleError) ||
    (runThroughShell
      ? addWindowsEnoentError(fixer, originalCommand, 'spawnSync')
      : null);

  logger.info(`FIXER EXIT CODE: ${exitcode}`);

  // PHPCS 3.x's phpcbf writes "ERROR" status lines to stdout mixed with the
  // fixed file content; PHPCS 4.x writes errors to stderr instead. Log stdout
  // only when it looks like a 3.x error line to avoid dumping fixed file
  // content into the output channel.
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
   * PHPCBF exit codes:
   *
   * PHP_CodeSniffer 3.x:
   * 0: no fixable errors were found, so nothing was fixed
   * 1: all fixable errors were fixed correctly
   * 2: PHPCBF failed to fix some of the fixable errors it found
   * 3: processing / script execution error
   *
   * PHP_CodeSniffer 4.x:
   * 0: clean / auto-fixed with no remaining issues
   * 1: issues found/remaining, auto-fixable
   * 2: issues found/remaining, non-auto-fixable
   * 4: failure to fix some files / fixer conflict (phpcbf only)
   * 5: 1 + 4 (phpcbf only)
   * 7: 1 + 2 + 4 (phpcbf only)
   * 16, 64: processing / requirements errors
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
    // PHPCS 4.x: fixer conflict (4) and combinations 5=1+4, 7=1+2+4.
    case 4:
    case 5:
    case 7: {
      // If stdout has valid fixed output (and doesn't contain error messages),
      // then apply it even though some fixable errors failed to be fixed.
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
 * Build the spawn command and the original (pre-quoting) command/args used
 * for Windows ENOENT error reporting. Mirrors `buildSnifferCommand` in
 * `sniffer.ts`.
 */
const buildFixerCommand = (
  resourceConf: ResourceSettings,
  lintArgs: string[],
): FixerCommand => {
  if (resourceConf.dockerEnabled) {
    const commandArgs = [
      'exec',
      '-i',
      resourceConf.dockerContainer,
      resourceConf.dockerExecutablePathCBF,
      ...lintArgs,
    ];
    return {
      commandPath: resourceConf.dockerContainerExec,
      commandArgs,
      command: formatCommandForLog(
        resourceConf.dockerContainerExec,
        commandArgs,
      ),
      runThroughShell: false,
    };
  }

  return {
    commandPath: resourceConf.executablePathCBF,
    commandArgs: lintArgs,
    command: constructCommandString(
      resourceConf.executablePathCBF,
      parseArgs(lintArgs),
    ),
    runThroughShell: true,
  };
};

const formatCommandForLog = (command: string, args: string[]): string =>
  [command, ...args].join(' ');

/**
 * Check if the fixer output represents successfully fixed code
 *
 * It checks if the output is valid by ensuring:
 * - it's length is greater than 0; AND
 * - is different to the input file text; AND
 * - it doesn't start with a newline (EOL) character (all stdout errors start with a newline).
 *
 * @param {string} fileText The original file text
 * @param {string} stdout The raw stdout (for EOL checking)
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
