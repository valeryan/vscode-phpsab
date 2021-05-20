/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2017 Esben Petersen
 * Copyright (c) 2020 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { window } from "vscode";

export type LogLevel = "INFO" | "ERROR";

export class Logger {
    private outputChannel = window.createOutputChannel(
        "PHP Sniffer & Beautifier"
    );

    private logLevel: LogLevel = "ERROR";

    private startTime: {
        [key: string]: Date;
    } = { logger: new Date() };

    public setOutputLevel(logLevel: LogLevel) {
        this.logLevel = logLevel;
    }

    /**
     * Append messages to the output channel and format it with a title
     *
     * @param message The message to append to the output channel
     */
    public logInfo(message: string, data?: unknown): void {
        if (this.logLevel === "ERROR") {
            return;
        }
        this.logMessage(message, "INFO");
        if (data) {
            this.logObject(data);
        }
    }

    public logError(message: string, error?: Error | string) {
        this.logMessage(message, "ERROR");
        if (typeof error === "string") {
            // Errors as a string usually only happen with
            // plugins that don't return the expected error.
            this.outputChannel.appendLine(error);
        } else if (error?.message || error?.stack) {
            if (error?.message) {
                this.logMessage(error.message, "ERROR");
            }
            if (error?.stack) {
                this.outputChannel.appendLine(error.stack);
            }
        } else if (error) {
            this.logObject(error);
        }
    }

    /**
     * Start a timer
     */
    public time(key: string) {
        this.startTime[key] = new Date();
        this.logInfo(key + " running");
    }

    /**
     * Log timer result
     */
    public timeEnd(key: string) {
        let endTime = new Date();
        let timeDiff = endTime.valueOf() - this.startTime[key].valueOf();
        // strip the ms
        let seconds = timeDiff / 1000;
        this.logInfo(key + " ran for " + seconds + " seconds");
    }

    public show() {
        this.outputChannel.show();
    }

    private logObject(data: unknown): void {
        const message = JSON.stringify(data, null, 2).trim();
        this.outputChannel.appendLine(message);
    }

    /**
     * Append messages to the output channel and format it with a title
     *
     * @param message The message to append to the output channel
     */
    private logMessage(message: string, logLevel: LogLevel): void {
        const title = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`["${logLevel}" - ${title}] ${message}`);
    }
}
