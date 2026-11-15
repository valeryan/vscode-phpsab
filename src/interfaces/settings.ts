import type { Disposable, Event } from 'vscode';
import { ToolExecutable } from './common';

export type SnifferMode = 'onSave' | 'onType';

/**
 * Global settings
 */
export interface Settings {
  /**
   * The workspace-specific resource settings.
   */
  resources: ResourceSettings[];

  /**
   * Whether debug mode is enabled for the extension.
   */
  debug: boolean;

  /**
   * The mode in which the sniffer operates, either 'onSave' or 'onType'.
   */
  snifferMode: SnifferMode;

  /**
   * The delay in milliseconds for the sniffer when operating in 'onType' mode.
   */
  snifferTypeDelay: number;

  /**
   * Whether to show the sniff sources of issues.
   */
  snifferShowSources: boolean;

  /**
   * Whether to show fixability icons for sniffer issues.
   */
  snifferShowFixabilityIcons: boolean;

  /**
   * The path to the PHP executable.
   */
  phpExecutablePath: string;
}

/**
 * Workspace-specific resource settings
 */
export interface ResourceSettings {
  /**
   * The workspace root path.
   */
  workspaceRoot: string | null;

  /**
   * Whether the fixer is enabled.
   */
  fixerEnable: boolean;

  /**
   * The arguments to pass to the fixer.
   */
  fixerArguments: string[];

  /**
   * Whether the sniffer is enabled.
   */
  snifferEnable: boolean;

  /**
   * The arguments to pass to the sniffer.
   */
  snifferArguments: string[];

  /**
   * The path to the CBF executable.
   */
  executablePathCBF: string;

  /**
   * The path to the CS executable.
   */
  executablePathCS: string;

  /**
   * The path to the composer.json file.
   */
  composerJsonPath: string;

  /**
   * The coding standard to use.
   */
  standard: string | null;

  /**
   * Whether to automatically search for rulesets.
   */
  autoRulesetSearch: boolean;

  /**
   * The allowed auto-detected rulesets.
   */
  allowedAutoRulesets: string[];

  /**
   * The glob patterns to exclude files/directories from analysis.
   */
  excludeGlobs: string[];
}

/**
 * Describes a completed settings reload.
 */
export interface SettingsChange {
  /**
   * The settings before the reload, or `undefined` for the initial load.
   */
  previous: Settings | undefined;

  /**
   * The newly loaded settings.
   */
  current: Settings;

  /**
   * Whether the sniffer should update its validation listener.
   */
  shouldUpdateSnifferValidatorListener: boolean;
}

/**
 * Shared access to the current settings and settings reload notifications.
 */
export interface SettingsManager extends Disposable {
  /**
   * The current settings. Only valid after the initial `reload()` has resolved.
   */
  readonly current: Settings;

  /**
   * Fires after each successful settings reload.
   */
  readonly onDidChange: Event<SettingsChange>;

  /**
   * Reload the settings.
   */
  reload(): Promise<Settings>;
}

/**
 * The mapping of tool executable names to the setting key holding their executable path,
 * i.e., 'phpcs' -> 'executablePathCS', 'phpcbf' -> 'executablePathCBF'.
 */
export const executableSettingKeys = {
  phpcs: 'executablePathCS',
  phpcbf: 'executablePathCBF',
} as const satisfies Record<ToolExecutable, keyof ResourceSettings>;
