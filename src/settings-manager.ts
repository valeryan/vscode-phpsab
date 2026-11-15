import { Disposable, EventEmitter, workspace } from 'vscode';
import {
  Settings,
  SettingsChange,
  SettingsManager,
} from './interfaces/settings';
import { logger } from './logger';
import { loadSettings } from './settings';

/**
 * Create the shared settings manager and register its reload listeners.
 * @returns {SettingsManager} The shared settings manager instance.
 */
export const createSettingsManager = (): SettingsManager => {
  /**
   * The current settings instance, or undefined if not yet loaded.
   * @type {Settings | undefined}
   */
  let settings: Settings | undefined;

  /**
   * The promise representing the in-flight settings reload,
   * or undefined if no reload is currently running.
   * @type {Promise<Settings> | undefined}
   */
  let running: Promise<Settings> | undefined;

  /**
   * Indicates whether a settings reload is pending due to configuration changes.
   * @type {boolean}
   */
  let reloadPending: boolean = false;

  /**
   * Indicates whether the sniffer validator listener needs to be updated.
   * @type {boolean}
   */
  let shouldUpdateSnifferValidatorListenerPending: boolean = false;

  /**
   * The event emitter used to notify listeners of settings changes.
   * @type {EventEmitter<SettingsChange>}
   */
  const emitter: EventEmitter<SettingsChange> =
    new EventEmitter<SettingsChange>();

  /**
   * The array of disposables to be cleaned up when the settings manager is disposed.
   * @type {Disposable[]}
   */
  const disposables: Disposable[] = [];

  /**
   * The configuration change event listener that will trigger a settings reload when
   * relevant configuration changes.
   * @type {Disposable}
   */
  const configurationChangeEvent: Disposable =
    workspace.onDidChangeConfiguration((event) => {
      // If the sniffer mode or type delay has changed, mark that
      // the sniffer validator listener needs to be updated.
      if (
        event.affectsConfiguration('phpsab.snifferMode') ||
        event.affectsConfiguration('phpsab.snifferTypeDelay')
      ) {
        shouldUpdateSnifferValidatorListenerPending = true;
      }

      // If any configuration from this extension (phpsab) or
      // external php extensions has changed, trigger a reload.
      if (
        event.affectsConfiguration('phpsab') ||
        event.affectsConfiguration('php')
      ) {
        reloadFromEvent('configuration change');
      }
    });

  /**
   * The Workspace Folders change event listener that will trigger a settings reload when
   * workspace folders change.
   * @type {Disposable}
   */
  const workspaceFoldersChangeEvent: Disposable =
    workspace.onDidChangeWorkspaceFolders(() => {
      reloadFromEvent('workspace folder change');
    });

  // Add the disposables to the array for cleanup on dispose.
  disposables.push(emitter);
  disposables.push(configurationChangeEvent);
  disposables.push(workspaceFoldersChangeEvent);

  /**
   * Reload settings from an event and log failures that cannot be returned
   * to the event source.
   * @param {string} event A string describing the event that triggered the reload.
   */
  const reloadFromEvent = (event: string): void => {
    void reload().catch((error: unknown) => {
      logger.error(`Failed to reload settings after ${event}: ${error}`);
    });
  };

  /**
   * Reload the settings, handling any changes and notifying listeners.
   * @returns {Promise<Settings>} The final loaded settings after the reload.
   */
  const reload = (): Promise<Settings> => {
    // If a reload is already in progress, mark it as pending and return the existing promise.
    if (running) {
      // Reuse the in-flight promise; runReload will repeat before resolving.
      reloadPending = true;
      return running;
    }

    // No reload is currently in progress, so start a new one.
    running = runReload().finally(() => {
      running = undefined;
    });

    return running;
  };

  /**
   * Run the settings reload process, handling any changes and notifying listeners.
   * @returns {Promise<Settings>} The final loaded settings.
   */
  const runReload = async (): Promise<Settings> => {
    const previous = settings;
    let loadedSettings = false;

    // While a reload is pending, keep attempting to load the
    // settings until no further reloads are requested.
    do {
      reloadPending = false;
      try {
        settings = await loadSettings();
        loadedSettings = true;
      } catch (error) {
        if (!settings) {
          throw error;
        }
        // Keep the previous settings if a reload fails.
        logger.error(`Failed to load settings: ${error}`);
      }
    } while (reloadPending);

    // Notify consumers once with the final settings after any coalesced reloads.
    // A failed load with existing settings should not emit a change event.
    if (loadedSettings) {
      const current = settings!;
      // Determine if the sniffer validator listener needs to be updated by
      // checking if the relevant settings have changed.
      const shouldUpdateSnifferValidatorListener =
        shouldUpdateSnifferValidatorListenerPending ||
        previous?.snifferMode !== current.snifferMode ||
        previous?.snifferTypeDelay !== current.snifferTypeDelay;

      // Reset the pending flag before firing the event.
      shouldUpdateSnifferValidatorListenerPending = false;

      // Fire the settings change event with the previous and current settings,
      // along with the sniffer listener update flag.
      emitter.fire({ previous, current, shouldUpdateSnifferValidatorListener });
    }

    return settings!;
  };

  // Return the settings manager object with the current settings,
  // change event, reload, and dispose methods.
  return {
    get current(): Settings {
      if (!settings) {
        throw new Error('Settings have not been loaded yet.');
      }
      return settings;
    },
    onDidChange: emitter.event,
    reload,
    dispose: () => disposables.forEach((disposable) => disposable.dispose()),
  };
};
