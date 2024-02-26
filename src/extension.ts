/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { commands, ExtensionContext, languages } from 'vscode';
import { Fixer } from './fixer';
import { Settings } from './interfaces/settings';
import { logger } from './logger';
import { loadSettings } from './settings';
import { Sniffer } from './sniffer';

// the application insights key (also known as instrumentation key)
const extensionName = process.env.EXTENSION_NAME || 'valeryanm.php-sab';
const extensionVersion = process.env.EXTENSION_VERSION || '0.0.0';

const activateFixer = (context: ExtensionContext, settings: Settings) => {
  const fixer = new Fixer(context.subscriptions, settings);

  // register format from command pallet
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
          return fixer.registerDocumentProvider(document, range);
        },
      },
    ),
  );
};

const activateSniffer = (context: ExtensionContext, settings: Settings) => {
  const sniffer = new Sniffer(context.subscriptions, settings);
  context.subscriptions.push(sniffer);
};

/**
 * Activate Extension
 * @param context
 */
export const activate = async (context: ExtensionContext) => {
  // Always output extension information to channel on activate
  logger.log(`Extension Name: ${extensionName}.`);
  logger.log(`Extension Version: ${extensionVersion}.`);

  const settings = await loadSettings();
  activateFixer(context, settings);
  activateSniffer(context, settings);
};
