/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { ExtensionContext } from 'vscode';
import { activateFixer } from './fixer';
import { disposeLogger, logger } from './logger';
import { createSettingsManager } from './settings-manager';
import { activateSniffer, disposeSniffer } from './sniffer';
import { getExtensionInfo, setExtensionInfo } from './utils/helpers';

/**
 * Activate Extension
 * @param {ExtensionContext} context The extension context provided by VS Code
 */
export const activate = async (context: ExtensionContext) => {
  setExtensionInfo(context);
  const { id, displayName, version } = getExtensionInfo();

  // Always output extension information to channel on activate
  logger.log(`Extension ID: ${id}.`);
  logger.log(`Extension Display Name: ${displayName}.`);
  logger.log(`Extension Version: ${version}.`);

  // Create the settings manager and load the settings for the extension.
  const settingsManager = createSettingsManager();
  context.subscriptions.push(settingsManager);
  await settingsManager.reload();

  activateFixer(context.subscriptions, settingsManager);
  activateSniffer(context.subscriptions, settingsManager);
};

/**
 * Deactivate Extension
 */
export const deactivate = () => {
  disposeLogger();
  disposeSniffer();
};
