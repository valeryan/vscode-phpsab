'use strict';

import { commands, ExtensionContext, languages } from 'vscode';
import { Fixer } from './fixer';
import { Sniffer } from './sniffer';
import { Configuration } from './configuration';
import { Settings } from './settings';

function activateFixer(context: ExtensionContext, config: Settings) {
    if (config.fixerEnable === true) {
        if (config.debug) {
            console.log("----- ACTIVATE FIXER -----");
        }
        let fixer = new Fixer(context.subscriptions, config);

        // register format from command pallet
        context.subscriptions.push(
            commands.registerTextEditorCommand("fixer.fix", textEditor => {
                if (textEditor.document.languageId === "php") {
                    commands.executeCommand("editor.action.formatDocument");
                }
            })
        );

        // register as document formatter for php
        context.subscriptions.push(
            languages.registerDocumentFormattingEditProvider({ scheme: 'file', language: 'php' }, {
                provideDocumentFormattingEdits: (document) => {
                    return fixer.registerDocumentProvider(document);
                }
            })
        );
    }
}

function activateSniffer(context: ExtensionContext, config: Settings) {
    // register a document validator
    if (config.snifferEnable === true) {
        if (config.debug) {
            console.log("----- ACTIVATE SNIFFER -----");
        }
        context.subscriptions.push(new Sniffer(context.subscriptions, config));
    }
}
/**
 * Activate Extension
 * @param context
 */
export async function activate(context: ExtensionContext) {
    let configuration = new Configuration();
    let config = await configuration.load();
    activateFixer(context, config);
    activateSniffer(context, config);
}
