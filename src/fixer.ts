/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import * as spawn from "cross-spawn";
import { Configuration } from "./configuration";
import { Settings } from "./interfaces/settings";
import { StandardsPathResolver } from "./resolvers/standards-path-resolver";
import { ConsoleError } from "./interfaces/console-error";
import {
    window,
    TextDocument,
    Range,
    Position,
    TextEdit,
    ProviderResult,
    Disposable,
    workspace,
    ConfigurationChangeEvent,
} from "vscode";
import { SpawnSyncOptions } from "child_process";
import { Logger } from "./logger";
export class Fixer {
    public config!: Settings;

    constructor(
        subscriptions: Disposable[],

        config: Settings,

        private logger: Logger
    ) {
        this.config = config;
        workspace.onDidChangeConfiguration(
            this.loadSettings,
            this,
            subscriptions
        );
    }
    /**
     * Load Configuration from editor
     */
    public async loadSettings(event: ConfigurationChangeEvent) {
        if (
            !event.affectsConfiguration("phpsab") &&
            !event.affectsConfiguration("editor.formatOnSaveTimeout")
        ) {
            return;
        }
        let configuration = new Configuration(this.logger);
        let config = await configuration.load();
        this.config = config;
    }

    /**
     * Build the arguments needed to execute fixer
     * @param fileName
     * @param standard
     */
    private getArgs(
        document: TextDocument,
        standard: string,
        additionalArguments: string[]
    ) {
        // Process linting paths.
        let filePath = document.fileName;

        let args = [];
        args.push("-q");
        if (standard !== "") {
            args.push("--standard=" + standard);
        }
        args.push(`--stdin-path=${filePath}`);
        args = args.concat(additionalArguments);
        args.push("-");
        return args;
    }

    /**
     * run the fixer process
     * @param document
     */
    private async format(document: TextDocument, fullDocument: boolean) {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return "";
        }
        const resourceConf = this.config.resources[workspaceFolder.index];
        if (document.languageId !== "php") {
            return "";
        }

        if (resourceConf.fixerEnable === false) {
            window.showInformationMessage(
                "Fixer is disable for this workspace or PHPCBF was not found for this workspace."
            );
            return "";
        }
        this.logger.time("Fixer");

        const additionalArguments = resourceConf.fixerArguments.filter(
            (arg) => {
                if (
                    arg.indexOf("--standard") === -1 &&
                    arg.indexOf("--stdin-path") === -1 &&
                    arg !== "-q" &&
                    arg !== "-"
                ) {
                    return true;
                }

                return false;
            }
        );

        // setup and spawn fixer process
        const standard = await new StandardsPathResolver(
            document,
            resourceConf,
            this.logger
        ).resolve();

        const lintArgs = this.getArgs(document, standard, additionalArguments);

        let fileText = document.getText();

        const options: SpawnSyncOptions = {
            cwd:
                resourceConf.workspaceRoot !== null
                    ? resourceConf.workspaceRoot
                    : undefined,
            env: process.env,
            encoding: "utf8",
            input: fileText,
        };

        this.logger.logInfo(
            "FIXER COMMAND: " +
                resourceConf.executablePathCBF +
                " " +
                lintArgs.join(" ")
        );

        const fixer = spawn.sync(
            resourceConf.executablePathCBF,
            lintArgs,
            options
        );
        const stdout = fixer.stdout.toString().trim();

        let fixed = stdout + "\n";

        let errors: { [key: number]: string } = {
            3: "FIXER: A general script execution error occurred.",
            16: "FIXER: Configuration error of the application.",
            32: "FIXER: Configuration error of a Fixer.",
            64: "FIXER: Exception raised within the application.",
            255: "FIXER: A Fatal execution error occurred.",
        };

        let error: string = "";
        let result: string = "";
        let message: string = "No fixable errors were found.";

        /**
         * fixer exit codes:
         * Exit code 0 is used to indicate that no fixable errors were found, so nothing was fixed
         * Exit code 1 is used to indicate that all fixable errors were fixed correctly
         * Exit code 2 is used to indicate that FIXER failed to fix some of the fixable errors it found
         * Exit code 3 is used for general script execution errors
         */
        switch (fixer.status) {
            case null: {
                // deal with some special case errors
                error = "A General Execution error occurred.";

                if (fixer.error === undefined) {
                    break;
                }
                const execError: ConsoleError = fixer.error;
                if (execError.code === "ETIMEDOUT") {
                    error = "FIXER: Formatting the document timed out.";
                }

                if (execError.code === "ENOENT") {
                    error =
                        "FIXER: " +
                        execError.message +
                        ". executablePath not found.";
                }
                break;
            }
            case 0: {
                if (this.config.debug) {
                    window.showInformationMessage(message);
                }
                break;
            }
            case 1: {
                if (fixed.length > 0 && fixed !== fileText) {
                    result = fixed;
                    message = "All fixable errors were fixed correctly.";
                }

                if (this.config.debug) {
                    window.showInformationMessage(message);
                }

                break;
            }
            case 2: {
                if (fixed.length > 0 && fixed !== fileText) {
                    result = fixed;
                    message = "FIXER failed to fix some of the fixable errors.";
                }

                if (this.config.debug) {
                    window.showInformationMessage(message);
                }
                break;
            }
            default:
                error = errors[fixer.status];
                this.logger.logError(fixed);
        }

        this.logger.timeEnd("Fixer");

        if (error !== "") {
            return Promise.reject(error);
        }

        return result;
    }

    /**
     * Get the document range
     * @param document TextDocument
     * @returns Range
     */
    private documentFullRange = (document: TextDocument) =>
        new Range(
            new Position(0, 0),
            document.lineAt(document.lineCount - 1).range.end
        );

    /**
     *
     * @param range Range
     * @param document TextDocument
     * @returns boolean
     */
    private isFullDocumentRange = (range: Range, document: TextDocument) =>
        range.isEqual(this.documentFullRange(document));

    /**
     * Setup wrapper to format for extension
     * @param document
     */
    public registerDocumentProvider(
        document: TextDocument,
        range: Range
    ): ProviderResult<TextEdit[]> {
        return new Promise((resolve, reject) => {
            const fullRange = this.documentFullRange(document);
            const isFullDocument = this.isFullDocumentRange(range, document);

            this.format(document, isFullDocument)
                .then((text) => {
                    if (text.length > 0) {
                        resolve([new TextEdit(fullRange, text)]);
                    }
                    resolve([]);
                })
                .catch((err) => {
                    window.showErrorMessage(err);
                    reject();
                });
        });
    }
}
