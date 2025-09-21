import spawn from 'cross-spawn';
import { SpawnSyncOptions } from 'node:child_process';
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
import { addPhpToEnvPath } from './resolvers/path-resolver-utils';
import { createStandardsPathResolver } from './resolvers/standards-path-resolver';
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
  if (
    !event.affectsConfiguration('phpsab') &&
    !event.affectsConfiguration('editor.formatOnSaveTimeout')
  ) {
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
    args.push(`--standard=${standard}`);
  }
  args.push(`--stdin-path=${filePath}`);
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
 * Get the regex to match the error message when the `php` command is not found.
 *
 * ---
 *
 * Note:
 *
 * The regex is designed to match the various different OS and shell error messages
 * that indicate the `php` command is not found.
 * The regex is flexible to accommodate some of the most common formats
 * "command not found" errors. But there may be some edge cases where some OS and shells may
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
 * The final regex can be seen in action here: https://regex101.com/r/Ob1YKB/1
 */
const getPhpNotFoundRegex = (): RegExp => {
  // This regex will match `php`, with or without single or double quotes.
  const phpRegex = `(["']?php["']?)`;
  // This regex will match a single character either a colon OR a whitespace.
  const colonSingleRegex = `([:\s]+)?`;
  // This regex will match both a colon AND a whitespace.
  const colonGroupRegex = `((:\s)+)?`;

  // Combine the php and the colon regexes to match the php command with or without
  // a colon after it (e.g. "php: ").
  const colonAfterPhpRegex = new RegExp(`(${phpRegex}${colonSingleRegex})?`);

  // Combine the colon regex with the php regex to match php command with or without
  // a colon before it (e.g. ": php").
  const colonBeforePhpRegex = new RegExp(`${colonGroupRegex}${phpRegex}`);

  // The error regexes will match various error messages that indicate the
  // php command is not recognized.
  const errorRegexArray = [
    `is\\s+not\\s+recognized`,
    `command\\s+not\\s+found${colonBeforePhpRegex.source}?`,
    `cannot\\s+be\\s+found`,
    `unknown\\s+command\\s?${colonBeforePhpRegex.source}`,
  ];

  // Join the error regexes with OR operator.
  const errorRegex = new RegExp(errorRegexArray.join('|'));

  // Construct the final regex to match the php command error message.
  return new RegExp(`${colonAfterPhpRegex.source}(${errorRegex.source})`, 'i');
};

/**
 * run the fixer process
 * @param document
 */
const format = async (document: TextDocument, fullDocument: boolean) => {
  const settings = await getSettings();
  const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    return '';
  }
  const resourceConf = settings.resources[workspaceFolder.index];
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
  };

  logger.info(
    `FIXER COMMAND: ${resourceConf.executablePathCBF} ${lintArgs.join(' ')}`,
  );

  const fixer = spawn.sync(resourceConf.executablePathCBF, lintArgs, options);
  const stdout = fixer.stdout.toString().trim();
  const stderr = fixer.stderr.toString().trim();

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

  // Test the regex against the stderr output.
  //
  // If fixer returns with stderr as the error "php is not recognized" or equivalent,
  // then show an error message to the user because PHP is not on the system's environment path.
  if (getPhpNotFoundRegex().test(stderr)) {
    error = `Please add PHP to your system's environment path, or use the extension setting "phpExecutablePath". - PHPCBF error: ${stderr}`;

    window.showErrorMessage(error);
    return '';
  }

  /**
   * fixer exit codes:
   * Exit code 0 is used to indicate that no fixable errors were found, so nothing was fixed
   * Exit code 1 is used to indicate that all fixable errors were fixed correctly
   * Exit code 2 is used to indicate that FIXER failed to fix some of the fixable errors it found
   * Exit code 3 is used for general script execution errors
   */
  switch (fixer.status) {
    case null: {
      // deal with some special case errors
      error = 'A General Execution error occurred.';

      if (fixer.error === undefined) {
        break;
      }
      const execError: ConsoleError = fixer.error;
      if (execError.code === 'ETIMEDOUT') {
        error = 'FIXER: Formatting the document timed out.';
      }

      if (execError.code === 'ENOENT') {
        error = `FIXER: ${execError.message}. executablePath not found.`;
      }
      break;
    }
    case 0: {
      if (settings.debug) {
        window.showInformationMessage(message);
      }
      break;
    }
    case 1: {
      if (fixed.length > 0 && fixed !== fileText) {
        result = fixed;
        message = 'All fixable errors were fixed correctly.';
      }

      if (settings.debug) {
        window.showInformationMessage(message);
      }

      break;
    }
    case 2: {
      if (fixed.length > 0 && fixed !== fileText) {
        result = fixed;
        message = 'FIXER failed to fix some of the fixable errors.';
      }

      if (settings.debug) {
        window.showInformationMessage(message);
      }
      break;
    }
    default:
      error = errors[fixer.status];
      if (fixed.length > 0) {
        error += '\n' + fixed + '\n';
      }
      logger.error(fixed);
  }

  logger.endTimer('Fixer');

  if (error !== '') {
    return Promise.reject(error);
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
          return resolve([new TextEdit(fullRange, text)]);
        } else {
          throw new Error('PHPCBF returned an empty document');
        }
      })
      .catch((err) => {
        window.showErrorMessage(err);
        return reject(err);
      });
  });
};
