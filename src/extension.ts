/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { commands, ExtensionContext, extensions, languages } from 'vscode';
import { activateFixer, registerFixerAsDocumentProvider } from './fixer';
import { disposeLogger, logger } from './logger';
import { loadSettings } from './settings';
import { activateSniffer, disposeSniffer } from './sniffer';

/**
 * Activate Extension
 * @param context
 */
export const activate = async (context: ExtensionContext) => {
  // Get extension unique identifier from context
  const extensionId = context.extension.id;
  const extensionVersion =
    extensions.getExtension(extensionId)?.packageJSON.version;

  // Always output extension information to channel on activate
  logger.log(`Extension ID: ${extensionId}.`);
  logger.log(`Extension Version: ${extensionVersion}.`);

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
        provideDocumentRangeFormattingEdits: (document, range) => {
          return registerFixerAsDocumentProvider(document, range);
        },
      },
    ),
  );
};

export const deactivate = () => {
  disposeLogger();
  disposeSniffer();
};
