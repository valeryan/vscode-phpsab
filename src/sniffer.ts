import { debounce } from 'lodash';
import { spawn, SpawnOptions } from 'node:child_process';
import {
  CancellationTokenSource,
  ConfigurationChangeEvent,
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  Disposable,
  languages,
  Range,
  TextDocument,
  TextDocumentChangeEvent,
  Uri,
  window,
  workspace,
} from 'vscode';
import { ConsoleError } from './interfaces/console-error';
import { PHPCSMessageType, PHPCSReport } from './interfaces/phpcs-report';
import { Settings } from './interfaces/settings';
import { logger } from './logger';
import { createStandardsPathResolver } from './resolvers/standards-path-resolver';
import { loadSettings } from './settings';
import { addWindowsEnoentError } from './utils/error-handling/windows-enoent-error';
import {
  constructCommandString,
  determineNodeError,
  getArgs,
  parseArgs,
} from './utils/helpers';

const enum runConfig {
  save = 'onSave',
  type = 'onType',
}

let settingsCache: Settings;
const diagnosticCollection: DiagnosticCollection =
  languages.createDiagnosticCollection('php');

/**
 * The active validator listener.
 */
let validatorListener: Disposable;

/**
 * Token to cancel a current validation runs.
 */
const runnerCancellations: Map<Uri, CancellationTokenSource> = new Map();

const getSettings = async () => {
  if (!settingsCache) {
    settingsCache = await loadSettings();
  }
  return settingsCache;
};

/**
 * Lints a document.
 *
 * @param document - The document to lint.
 */
const validate = async (document: TextDocument) => {
  const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

  const settings = await getSettings();
  const resourceConf = settings.resources[workspaceFolder?.index ?? 0];
  if (document.languageId !== 'php' || resourceConf.snifferEnable === false) {
    return;
  }
  logger.startTimer('Sniffer');

  const oldRunner = runnerCancellations.get(document.uri);
  if (oldRunner) {
    oldRunner.cancel();
    oldRunner.dispose();
  }

  const runner = new CancellationTokenSource();
  runnerCancellations.set(document.uri, runner);
  const { token } = runner;

  let standard: string;

  try {
    standard = await createStandardsPathResolver(
      document,
      resourceConf,
    ).resolve();
  } catch (error: any) {
    window.showErrorMessage(error.message, 'OK');
    logger.error(error.message);

    return;
  }

  const lintArgs = getArgs(
    document.fileName,
    standard,
    resourceConf.snifferArguments,
    'sniffer',
  );

  let fileText = document.getText();

  const options: SpawnOptions = {
    cwd:
      resourceConf.workspaceRoot !== null
        ? resourceConf.workspaceRoot
        : undefined,
    env: process.env,
    // Required to prevent EINVAL errors when spawning .bat files on Windows.
    // https://github.com/valeryan/vscode-phpsab/issues/128
    // https://github.com/nodejs/node/issues/52554
    shell: true,
  };

  const CSExecutable = resourceConf.executablePathCS;
  const parsedArgs = parseArgs(lintArgs);

  const command = constructCommandString(CSExecutable, parsedArgs);

  logger.info(`SNIFFER COMMAND: ${command}`);

  const sniffer = spawn(command, options);

  // Set the original command information (not parsed) for Windows ENOENT error handling
  const originalCommand = {
    commandPath: CSExecutable,
    args: lintArgs,
  };

  addWindowsEnoentError(sniffer, originalCommand, 'spawn');

  if (sniffer.stdin) {
    sniffer.stdin.write(fileText);
    sniffer.stdin.end();
  } else {
    // Kill the process if we can't write to its `stdin`. We use `SIGKILL` to forcefully
    // terminate the process, and prevent it from hanging indefinitely.
    // This allows the `done` promise to resolve.
    sniffer.kill('SIGKILL');
  }

  let stdout = '';
  let stderr = '';
  let nodeError: ConsoleError | null = null;

  if (sniffer.stdout) {
    sniffer.stdout.on('data', (data) => (stdout += data));
  }
  if (sniffer.stderr) {
    sniffer.stderr.on('data', (data) => (stderr += data));
  }

  sniffer.on('error', (error) => (nodeError = error as ConsoleError));

  const done = new Promise<void>((resolve, reject) => {
    sniffer.on('close', (exitcode) => {
      logger.info(`SNIFFER EXIT CODE: ${exitcode}`);

      if (stdout) {
        logger.info(`SNIFFER STDOUT: ${stdout.trim()}`);
      }

      if (stderr) {
        logger.error(`SNIFFER STDERR: ${stderr.trim()}`);
      }

      // If the sniffer was cancelled, OR the process was killed manually, OR there's
      // no output from sniffer, then just resolve the promise and return early.
      if (token.isCancellationRequested || sniffer.killed || !stdout) {
        let errorMsg = '';
        let extraLoggerMsg = '';
        // If the process was killed manually, we log an error message and inform the user.
        if (sniffer.killed) {
          errorMsg =
            'Unable to communicate with PHPCS. Please check your installation/configuration and try again.';
          extraLoggerMsg = `\nSniffer stdin is null - cannot send file content to phpcs`;
        } else if (nodeError) {
          // Destructure the returned object and assign to variables.
          ({ errorMsg, extraLoggerMsg } = determineNodeError(
            nodeError,
            'sniffer',
          ));
        }

        logger.error(`${errorMsg}${extraLoggerMsg}`);
        window.showErrorMessage(errorMsg, 'OK');

        resolve();
        return;
      }
      const diagnostics: Diagnostic[] = [];
      // try-catch to handle JSON parse errors
      try {
        const { files }: PHPCSReport = JSON.parse(stdout);
        for (const file in files) {
          files[file].messages.forEach(
            ({ message, line, column, type, source, fixable }) => {
              const zeroLine = line - 1;
              const ZeroColumn = column - 1;

              const range = new Range(
                zeroLine,
                ZeroColumn,
                zeroLine,
                ZeroColumn,
              );
              const severity =
                type === PHPCSMessageType.ERROR
                  ? DiagnosticSeverity.Error
                  : DiagnosticSeverity.Warning;
              let output = message;
              if (settings.snifferShowSources) {
                output += `\n(${source})`;
              }
              output += `\nAuto-fixable: ${fixable ? '✔️' : '❌'}`;
              const diagnostic = new Diagnostic(range, output, severity);
              diagnostic.source = '\nphpcs';
              diagnostics.push(diagnostic);
            },
          );
        }
        resolve();
      } catch (error) {
        let message = '';
        if (stdout) {
          message += `${stdout}\n`;
        }
        if (stderr) {
          message += `${stderr}\n`;
        }
        if (error instanceof Error) {
          message += error.toString();
        } else {
          message += 'Unexpected error';
        }
        window.showErrorMessage(message, 'OK');
        logger.error(message);
        reject(message);
      }
      diagnosticCollection.set(document.uri, diagnostics);
      runner.dispose();
      runnerCancellations.delete(document.uri);
    });
  });

  window.setStatusBarMessage('PHP Sniffer: validating…', done);
  logger.endTimer('Sniffer');
};

/**
 * Refreshes validation on any open documents.
 */
const refresh = (): void => {
  diagnosticCollection!.clear();

  workspace.textDocuments.forEach(validate);
};

/**
 * Clears diagnostics from a document.
 *
 * @param document - The document to clear diagnostics of.
 */
const clearDocumentDiagnostics = ({ uri }: TextDocument): void => {
  diagnosticCollection.delete(uri);
};

/**
 * Sets the validation event listening.
 */
const setValidatorListener = async (): Promise<void> => {
  if (validatorListener) {
    validatorListener.dispose();
  }
  const settings = await getSettings();
  const run: runConfig = settings.snifferMode as runConfig;
  const delay: number = settings.snifferTypeDelay;

  if (run === (runConfig.type as string)) {
    const validator = debounce(
      ({ document }: TextDocumentChangeEvent): void => {
        validate(document);
      },
      delay,
    );
    validatorListener = workspace.onDidChangeTextDocument(validator);
  } else {
    validatorListener = workspace.onDidSaveTextDocument(validate);
  }
};

/**
 * Reacts on configuration change.
 *
 * @param event - The configuration change event.
 */
const onConfigChange = async (event: ConfigurationChangeEvent) => {
  if (!event.affectsConfiguration('phpsab')) {
    return;
  }
  settingsCache = await loadSettings();

  if (
    event.affectsConfiguration('phpsab.snifferMode') ||
    event.affectsConfiguration('phpsab.snifferTypeDelay')
  ) {
    setValidatorListener();
  }

  refresh();
};

/**
 * Dispose this object.
 */
export const disposeSniffer = (): void => {
  diagnosticCollection.clear();
  diagnosticCollection.dispose();
};

export const activateSniffer = async (
  subscriptions: Disposable[],
  settings: Settings,
) => {
  settingsCache = settings;

  workspace.onDidChangeConfiguration(onConfigChange, null, subscriptions);
  workspace.onDidOpenTextDocument(validate, null, subscriptions);
  workspace.onDidCloseTextDocument(
    clearDocumentDiagnostics,
    null,
    subscriptions,
  );
  workspace.onDidChangeWorkspaceFolders(refresh, this, subscriptions);

  refresh();
  setValidatorListener();
};
