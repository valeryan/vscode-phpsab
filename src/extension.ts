/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import { commands, ExtensionContext, languages, window } from "vscode";
import { Fixer } from "./fixer";
import { Sniffer } from "./sniffer";
import { Configuration } from "./configuration";
import { Settings } from "./interfaces/settings";

function activateFixer(context: ExtensionContext, settings: Settings) {
    let fixer = new Fixer(context.subscriptions, settings);

    // register format from command pallet
    context.subscriptions.push(
        commands.registerTextEditorCommand("fixer.fix", (textEditor) => {
            if (textEditor.document.languageId === "php") {
                commands.executeCommand("editor.action.formatDocument");
            }
        })
    );

    // register as document formatter for php
    context.subscriptions.push(
        languages.registerDocumentFormattingEditProvider(
            { scheme: "file", language: "php" },
            {
                provideDocumentFormattingEdits: (document) => {
                    return fixer.registerDocumentProvider(document);
                },
            }
        )
    );
}

function activateSniffer(context: ExtensionContext, settings: Settings) {
    let sniffer = new Sniffer(context.subscriptions, settings);
    context.subscriptions.push(sniffer);
}

/**
 * Activate Extension
 * @param context
 */
export async function activate(context: ExtensionContext) {
    let configuration = new Configuration();
    let settings = await configuration.load();
    activateFixer(context, settings);
    activateSniffer(context, settings);
}
