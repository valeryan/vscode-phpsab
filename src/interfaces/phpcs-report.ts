/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 wongjn. All rights reserved.
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
export const enum PHPCSMessageType {
    ERROR = "ERROR",
    WARNING = "WARNING",
}

export interface PHPCSMessage {
    message: string;
    source: string;
    severity: number;
    fixable: boolean;
    type: PHPCSMessageType;
    line: number;
    column: number;
}

export interface PHPCSCounts {
    errors: number;
    warning: number;
    fixable?: number;
}

export interface PHPCSFileStatus extends PHPCSCounts {
    messages: PHPCSMessage[];
}

export interface PHPCSReport {
    totals: PHPCSCounts;
    files: {
        [key: string]: PHPCSFileStatus;
    };
}
