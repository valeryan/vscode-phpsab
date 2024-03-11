import { ConsoleError } from '@phpsab/interfaces/console-error';
import { Settings } from '@phpsab/interfaces/settings';
import { createStandardsPathResolver } from '@phpsab/resolvers/standards-path-resolver';
import { logger } from '@phpsab/services/logger';
import { loadSettings } from '@phpsab/services/settings';
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
  if (standard !== '') {
    args.push('--standard=' + standard);
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
  };

  logger.info(
    `FIXER COMMAND: ${resourceConf.fixerExecutablePath} ${lintArgs.join(' ')}`,
  );

  const fixer = spawn.sync(resourceConf.fixerExecutablePath, lintArgs, options);
  const stdout = fixer.stdout.toString().trim();

  let fixed = stdout + '\n';

  let errors: { [key: number]: string } = {
    3: 'FIXER: A general script execution error occurred.',
    16: 'FIXER: Configuration error of the application.',
    32: 'FIXER: Configuration error of a Fixer.',
    64: 'FIXER: Exception raised within the application.',
    255: 'FIXER: A Fatal execution error occurred.',
  };

  let error: string | null = null;
  let result: string = '';
  let message: string = 'No fixable errors were found.';

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
      logger.info(message);
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

      logger.info(message);
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

      logger.info(message);
      if (settings.debug) {
        window.showInformationMessage(message);
      }
      break;
    }
    default:
      error = errors[fixer.status];
      if (fixed.length > 0) {
        error += '\n' + fixed;
      }
      logger.error(fixed);
  }

  logger.endTimer('Fixer');

  if (error) {
    logger.error(error);
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
): ProviderResult<TextEdit[]> => {
  return new Promise((resolve, reject) => {
    const fullRange = documentFullRange(document);

    format(document)
      .then((text) => {
        if (text.length > 0) {
          resolve([new TextEdit(fullRange, text)]);
        }
        throw new Error('PHPCBF returned an empty document');
      })
      .catch((err) => {
        window.showErrorMessage(err);
        reject();
      });
  });
};
