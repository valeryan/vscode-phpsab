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
import { determineNodeError } from './utils';

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
 * Build the arguments needed to execute fixer
 * @param fileName
 * @param standard
 */
const getArgs = (
  document: TextDocument,
  standard: string,
  additionalArguments: string[],
) => {
  // Process linting paths.
  let filePath = document.fileName;

  let args = [];
  args.push('-q');

  /**
   * Important Note as explained in PR #155:
   *
   * For the fixer to work properly, we don't add `shell: true` to spawn.sync's options,
   * so spawn runs with the default of `shell: false`. This is important because when spawn runs on
   * Windows with the default it automatically escapes the command and values, including
   * surrounding them in double quotes (" ").
   *
   * So we don't need to add double quotes around the values for the `--standard` and `--stdin-path`
   * options, otherwise the values will get double the amount of quotes and errors will occur.
   *
   * e.g. ["ERROR" - 10:33:56 PM] ERROR: the ""d:\Name\projects\my project\phpcs.xml"" coding
   * standard is not installed. The installed coding standards are MySource, PEAR, PSR1, PSR2,
   * PSR12, Squiz, Zend and JPSR12.
   *
   * The sniffer is different, it needs to be surrounded by double quotes.
   */

  if (standard !== '') {
    args.push(`--standard="${standard}"`);
  }
  args.push(`--stdin-path="${filePath}"`);
  args = args.concat(additionalArguments);
  args.push('-');
  return args;
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
  if (document.languageId !== 'php') {
    return '';
  }

  if (resourceConf.fixerEnable === false) {
    window.showInformationMessage(
      'Fixer is disable for this workspace or PHPCBF was not found for this workspace.',
    );
    return '';
  }
  logger.startTimer('Fixer');

  const additionalArguments = resourceConf.fixerArguments.filter((arg) => {
    if (
      arg.indexOf('--standard') === -1 &&
      arg.indexOf('--stdin-path') === -1 &&
      arg !== '-q' &&
      arg !== '-'
    ) {
      return true;
    }

    return false;
  });

  // setup and spawn fixer process
  const standard = await createStandardsPathResolver(
    document,
    resourceConf,
  ).resolve();

  const lintArgs = getArgs(document, standard, additionalArguments);

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

  logger.info(
    `FIXER COMMAND: ${resourceConf.executablePathCBF} ${lintArgs.join(' ')}`,
  );

  const fixer = spawnSync(resourceConf.executablePathCBF, lintArgs, options);
  const exitcode = fixer.status;
  const stdout = fixer.stdout.toString();
  const stderr = fixer.stderr.toString();
  const nodeError = fixer.error as ConsoleError;

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

  let error: string = '';
  let result: string = '';
  let message: string = 'No fixable errors were found.';
  let errorMsg: string = '';
  let extraLoggerMsg: string = '';

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
