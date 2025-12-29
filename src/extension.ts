/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { commands, ExtensionContext, languages } from 'vscode';
import { activateFixer, registerFixerAsDocumentProvider } from './fixer';
import { disposeLogger, logger } from './logger';
import { loadSettings } from './settings';
import { activateSniffer, disposeSniffer } from './sniffer';
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
  activateFixer(context.subscriptions, settings);
  activateSniffer(context.subscriptions, settings);
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
          logger.info(`Starting to format the document: ${document.fileName}`);
          try {
            return await registerFixerAsDocumentProvider(document, range);
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
