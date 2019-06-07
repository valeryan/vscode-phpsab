"use strict";

export interface ConsoleError extends Error {
    code?: string;
}
