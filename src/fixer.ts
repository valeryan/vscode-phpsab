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

  // Set the original (unquoted) command information for Windows ENOENT error handling. With shell: true,
  // cmd.exe swallows a missing-executable ENOENT and exits 1 instead of surfacing it, so
  // addWindowsEnoentError reconstructs it; on *nix Node already populates fixer.error directly.
  const originalCommand = {
    commandPath: CBFExecutable,
    args: lintArgs,
  };

  const nodeError =
    (fixer.error as ConsoleError) ||
    addWindowsEnoentError(fixer, originalCommand, 'spawnSync');

  logger.info(`FIXER EXIT CODE: ${exitcode}`);

  // PHPCS 3.x's phpcbf writes "ERROR" status lines to stdout mixed with the fixed file content; PHPCS 4.x
  // writes errors to stderr instead. Log stdout only when it looks like a 3.x error line to avoid dumping
  // fixed file content into the output channel.
  if (stdout && (stdout.startsWith('ERROR') || stdout.startsWith(getEOL()))) {
    logger.info(`FIXER STDOUT: ${stdout.trim()}`);
  }

  if (stderr) {
    logger.error(`FIXER STDERR: ${stderr.trim()}`);
  }

  let fixed = stdout;

  // PHPCS-specific exit-code labels. (Earlier versions of this map used PHP-CS-Fixer
  // labels by mistake - different tool, different codes.)
  const errors: { [key: number]: string } = {
    3: 'FIXER: Processing / script execution error (PHPCS 3.x).',
    16: 'FIXER: Processing error — invalid CLI options or ruleset (PHPCS 4.x).',
    64: 'FIXER: Requirements not met — PHP version or missing extensions (PHPCS 4.x).',
    255: 'FIXER: A fatal execution error occurred.',
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
    // 2 has different meanings between versions:
    //  - PHPCS 3.x phpcbf: some fixable errors failed to fix.
    //  - PHPCS 4.x phpcbf (NON_FIXABLE): auto-fixable were fixed, but non-auto-fixable issues remain.
    // 4 / 5 / 7 are PHPCS 4.x bitmask combinations involving FAILED_TO_FIX. In every case, stdout (when
    // valid) contains the partially / fully fixed file and should be applied. The user-facing message is
    // unified — neutral wording that's accurate for both versions.
    case 2:
    case 4:
    case 5:
    case 7: {
      if (hasValidFixedOutput(stdout, fileText)) {
        result = fixed;
        message =
          'FIXER applied auto-fixes; some issues could not be auto-fixed.';
      } else if (nodeError) {
        ({ errorMsg, extraLoggerMsg } = determineNodeError(nodeError, 'fixer'));
        error += errorMsg;
      } else {
        // No fixes applied (e.g. PHPCS 4.x exit 2 with only non-fixable issues, or 3.x exit 2
        // where every fix attempt failed). Inform without error.
        message =
          'No auto-fixable issues were applied; non-auto-fixable issues remain.';
      }

      break;
    }
    default:
      // A PHPCBF error occurred. stdout has already been logged above; don't splat it into the user's error dialog.
      error =
        errors[exitcode] ||
        `FIXER: An unknown error occurred with exit code ${exitcode}.`;
      if (nodeError) {
        ({ errorMsg, extraLoggerMsg } = determineNodeError(nodeError, 'fixer'));
        error += ` ${errorMsg}`;
      }
  }

  logger.endTimer('Fixer');

  if (error !== '') {
    logger.error(`${error}${extraLoggerMsg}`);
    return Promise.reject(error);
  }

  if (message !== '') {
    window.showInformationMessage(message);
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
