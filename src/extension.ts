/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import { commands, ExtensionContext, languages } from "vscode";
import { Fixer } from "./fixer";
import { Logger } from "./logger";
import { Sniffer } from "./sniffer";
import { Configuration } from "./configuration";
import { Settings } from "./interfaces/settings";

// the application insights key (also known as instrumentation key)
const extensionName = process.env.EXTENSION_NAME || "dev.prettier-vscode";
const extensionVersion = process.env.EXTENSION_VERSION || "0.0.0";

function activateFixer(
    context: ExtensionContext,
    settings: Settings,
    logger: Logger
) {
    const fixer = new Fixer(context.subscriptions, settings, logger);

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
        languages.registerDocumentRangeFormattingEditProvider(
            { scheme: "file", language: "php" },
            {
                provideDocumentRangeFormattingEdits: (document, range) => {
                    return fixer.registerDocumentProvider(document, range);
                },
            }
        )
    );
}

function activateSniffer(
    context: ExtensionContext,
    settings: Settings,
    logger: Logger
) {
    const sniffer = new Sniffer(context.subscriptions, settings, logger);
    context.subscriptions.push(sniffer);
}

/**
 * Activate Extension
 * @param context
 */
export async function activate(context: ExtensionContext) {
    const logger = new Logger();
    // Always output extension information to channel on activate
    logger.logInfo(`Extension Name: ${extensionName}.`);
    logger.logInfo(`Extension Version: ${extensionVersion}.`);

    const configuration = new Configuration(logger);
    const settings = await configuration.load();
    activateFixer(context, settings, logger);
    activateSniffer(context, settings, logger);
}
