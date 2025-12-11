/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
  activateFixer,
  registerFixerAsDocumentProvider,
} from '@phpsab/services/fixer';
import { disposeLogger, logger } from '@phpsab/services/logger';
import { loadSettings } from '@phpsab/services/settings';
import { activateSniffer, disposeSniffer } from '@phpsab/services/sniffer';
import { ExtensionContext, commands, languages } from 'vscode';
import { getExtensionInfo, setExtensionInfo } from './utils/helpers';

/**
 * Activate Extension
 * @param context
 */
export const activate = async (context: ExtensionContext) => {
  setExtensionInfo(context);
  const { id, displayName, version } = getExtensionInfo();

  // Always output extension information to channel on activate
  logger.log(`Extension ID: ${id}.`);
  logger.log(`Extension Display Name: ${displayName}.`);
  logger.log(`Extension Version: ${version}.`);

  const settings = await loadSettings();
  activateSniffer(context.subscriptions, settings);
  activateFixer(context.subscriptions, settings);
  // register format from command palette
  context.subscriptions.push(
    commands.registerTextEditorCommand('fixer.fix', (textEditor) => {
      if (textEditor.document.languageId === 'php') {
        commands.executeCommand('editor.action.formatDocument');
      }
    }),
  );

  // register as document formatter for php
  context.subscriptions.push(
    languages.registerDocumentRangeFormattingEditProvider(
      { scheme: 'file', language: 'php' },
      {
        provideDocumentRangeFormattingEdits: async (document, range) => {
          logger.info(
            `DEBUG: Starting format with document: ${document.fileName}`,
          );
          logger.info(`DEBUG: Range: ${JSON.stringify(range)}`);
          try {
            return await registerFixerAsDocumentProvider(document);
          } catch (error) {
            logger.error(`DEBUG: Error in provider: ${error}`);
            throw error;
          }
        },
      },
    ),
  );
};

export const deactivate = () => {
  disposeLogger();
  disposeSniffer();
};
