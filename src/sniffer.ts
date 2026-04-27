import crossSpawn from 'cross-spawn';
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
import {
  PHPCSFileStatus,
  PHPCSMessageType,
  PHPCSReport,
} from './interfaces/phpcs-report';
import { ResourceSettings } from './interfaces/resource-settings';
import { Settings } from './interfaces/settings';
import { logger } from './logger';
import { toContainerPath, toHostPath } from './resolvers/docker-path-resolver';
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
  parseArgs,
  shouldProcess,
} from './utils/helpers';

const enum runConfig {
  save = 'onSave',
  type = 'onType',
}

let settingsCache: Settings;
const diagnosticCollection: DiagnosticCollection =
  languages.createDiagnosticCollection('php');

type SnifferCommand = {
  commandPath: string;
  commandArgs: string[];
  command: string;
  runThroughShell: boolean;
};

/**
 * The active validator listener.
 */
let validatorListener: Disposable;

/**
 * Token to cancel a current validation runs.
 */
const runnerCancellations: Map<Uri, CancellationTokenSource> = new Map();

const getSettings = () => {
  return settingsCache;
};

/**
 * Lints a document.
 *
 * @param document - The document to lint.
 */
const validate = async (document: TextDocument) => {
  const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

  const settings = getSettings();
  const resourceConf = settings.resources[workspaceFolder?.index ?? 0];

  // If the document should not be processed, return early.
  if (shouldProcess(document, resourceConf, 'sniffer') === false) {
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

  if (resourceConf.dockerEnabled) {
    standard = await remapStandardForContainer(standard, resourceConf);
  }

  // Path passed to phpcs as --stdin-path (or as the positional file in file mode).
  const filePath = resourceConf.dockerEnabled
    ? toContainerPath(
        document.fileName,
        resourceConf.workspaceRoot ?? '',
        resourceConf.dockerWorkspaceRoot,
      )
    : document.fileName;

  // dockerUseFilepath is sniffer-only; the fixer ignores it.
  const useFilepath =
    resourceConf.dockerEnabled && resourceConf.dockerUseFilepath;

  const lintArgs = getArgs(
    filePath,
    standard,
    resourceConf.snifferArguments,
    'sniffer',
    useFilepath,
  );

  let fileText = document.getText();

  const { commandPath, commandArgs, command, runThroughShell } =
    buildSnifferCommand(resourceConf, lintArgs);

  const options: SpawnOptions = {
    cwd:
      resourceConf.workspaceRoot !== null
        ? resourceConf.workspaceRoot
        : undefined,
    env: process.env,
    // Required to prevent EINVAL errors when spawning .bat files on Windows.
    // https://github.com/valeryan/vscode-phpsab/issues/128
    // https://github.com/nodejs/node/issues/52554
    // Local execution keeps shell mode for .bat/wrapper compatibility.
    // Docker execution uses cross-spawn without shell to avoid the extra
    // cmd.exe layer on Windows.
    shell: runThroughShell,
  };

  logger.info(`SNIFFER COMMAND: ${command}`);

  const sniffer = runThroughShell
    ? spawn(command, options)
    : crossSpawn(commandPath, commandArgs, options);

  // Set the original command information (not parsed) for Windows ENOENT error handling
  const originalCommand = {
    commandPath,
    args: commandArgs,
  };

  // Only needed when CMD is in the loop (shell: true) — CMD swallows ENOENT
  // and exits 1. cross-spawn emits a real ENOENT 'error' event on its own.
  if (runThroughShell) {
    addWindowsEnoentError(sniffer, originalCommand, 'spawn');
  }

  if (sniffer.stdin) {
    if (!useFilepath) {
      sniffer.stdin.write(fileText);
    }
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
        }
        // Check if there was a node error during the spawn process.
        else if (nodeError) {
          // Destructure the returned object and assign to variables.
          ({ errorMsg, extraLoggerMsg } = determineNodeError(
            nodeError,
            'sniffer',
          ));
        }
        // Check if stderr returns with the "php is not recognized" or equivalent error.
        // If it does, then show an error message to the user because PHP is not on the
        // system's environment path.
        else if (getPhpNotFoundRegex().test(stderr)) {
          errorMsg = `Please add PHP to your system's environment path, or use the extension setting "phpExecutablePath". - PHPCS error: ${stderr}`;
        }

        logger.error(`${errorMsg}${extraLoggerMsg}`);
        window.showErrorMessage(errorMsg, 'OK');

        resolve();
        return;
      }
      const diagnostics: Diagnostic[] = [];
      // try-catch to handle JSON parse errors
      try {
        let { files }: PHPCSReport = JSON.parse(stdout);

        // Remap container-side report keys back to host paths so any
        // multi-file report iteration lines up with VS Code documents.
        if (resourceConf.dockerEnabled) {
          files = Object.entries(files).reduce<{
            [key: string]: PHPCSFileStatus;
          }>((carry, [reportPath, status]) => {
            const hostKey = toHostPath(
              reportPath,
              resourceConf.workspaceRoot ?? '',
              resourceConf.dockerWorkspaceRoot,
            );
            carry[hostKey] = status;
            return carry;
          }, {});
        }

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
              if (settings.snifferShowFixabilityIcons) {
                output += `\nAuto-fixable: ${fixable ? '✔️' : '❌'}`;
              }
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
 * Build the spawn command and the original (pre-quoting) command/args used
 * for Windows ENOENT error reporting.
 *
 * In Docker mode the command is `<dockerContainerExec> exec -i <container>
 * <dockerExecutablePathCS> …lintArgs`; in local mode it's `<executablePathCS> …lintArgs`.
 */
const buildSnifferCommand = (
  resourceConf: ResourceSettings,
  lintArgs: string[],
): SnifferCommand => {
  if (resourceConf.dockerEnabled) {
    const commandArgs = [
      'exec',
      '-i',
      resourceConf.dockerContainer,
      resourceConf.dockerExecutablePathCS,
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
    commandPath: resourceConf.executablePathCS,
    commandArgs: lintArgs,
    command: constructCommandString(
      resourceConf.executablePathCS,
      parseArgs(lintArgs),
    ),
    runThroughShell: true,
  };
};

const formatCommandForLog = (command: string, args: string[]): string =>
  [command, ...args].join(' ');

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
  const settings = getSettings();
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
