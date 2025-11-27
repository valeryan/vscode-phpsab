/**
 * File taken and adapted from the moxystudio/node-cross-spawn package, which is now unmaintained.
 *
 * This file contains code to handle the ENOENT error on Windows.
 * When spawning a command using CMD, and the command is not found, CMD exits with code 1
 * instead of erroring as ENOENT and then returns the `is not recognized as an internal or
 * external command` message.
 * Whereas on *nix systems, the error is handled correctly by default. This lack of error handling
 * on Windows prevents us from showing a useful error message to the user when PHPCS or PHPCBF
 * fail to run in the extension.
 *
 * See https://github.com/moxystudio/node-cross-spawn/issues/16
 *
 * The original source can be found here:
 * https://github.com/moxystudio/node-cross-spawn
 */

import { ChildProcess, SpawnSyncReturns } from 'node:child_process';
import { existsSync } from 'node:fs';
import { logger } from '../../logger';
import { isWin } from '../../resolvers/path-resolver-utils';

/**
 * Add ENOENT error handling for Windows spawned processes using spawn or spawnSync.
 * @param {ChildProcess| SpawnSyncReturns<string | Buffer>} cp The ChildProcess instance or SpawnSyncReturns object
 * @param {any} originalCommand The original command information
 * @returns {Error | null | void} For spawnSync returns the `Error` object if ENOENT detected, `null` otherwise. For spawn and non-Windows systems returns `void`.
 */
export function addWindowsEnoentError(
  cp: ChildProcess | SpawnSyncReturns<string | Buffer>,
  originalCommand: any,
  syscall: 'spawn' | 'spawnSync',
): Error | null | void {
  // If not on Windows, don't do anything
  if (!isWin()) {
    logger.info('Not on Windows, skipping ENOENT handler setup.');
    return;
  }

  if (syscall === 'spawn') {
    // For spawn, we can hook into the `emit` method of the ChildProcess instance
    // to catch the "exit" event and emit an "error" event instead with the verified ENOENT error.
    hookIntoEmit(cp as ChildProcess, originalCommand);
  } else if (syscall === 'spawnSync') {
    // For spawnSync, we just need to verify the ENOENT error after execution since it does not emit events.

    const status = (cp as SpawnSyncReturns<Buffer>).status;
    return verifyEnoentError(status, originalCommand, syscall);
  }
}

/**
 * Hook into the `emit` method of the spawn ChildProcess instance to handle ENOENT errors.
 * @param {ChildProcess} cp The ChildProcess instance
 * @param {any} originalCommand The original command information
 */
function hookIntoEmit(cp: ChildProcess, originalCommand: any) {
  // Store original emit method
  const originalEmit = cp.emit.bind(cp);

  // Override emit method with custom logic to handle "exit" events
  cp.emit = function (name: string, ...args: any[]) {
    // If emitting "exit" event...
    if (name === 'exit') {
      // Verify if it is indeed an ENOENT error.
      const err = verifyEnoentError(args[0], originalCommand, 'spawn');

      // If there is an error, emit "error" event instead of "exit"
      // with the error object.
      if (err) {
        return originalEmit('error', err);
      }
    }

    // For all other events, just call the original emit method.
    return originalEmit(name, ...args);
  } as any;
}

/**
 * Verify if the error is an ENOENT error.
 * @param {number | null} status Exit status code
 * @param {any} originalCommand The original command information
 * @param {'spawn' | 'spawnSync'} syscall The syscall type, either `'spawn'` or `'spawnSync'`
 * @returns {Error | null} The ENOENT error or null
 */
function verifyEnoentError(
  status: number | null,
  originalCommand: any,
  syscall: 'spawn' | 'spawnSync',
) {
  // If the exit code is `1` AND no file was found (the command) OR
  // the command path does not exist, then we can assume it's an ENOENT error,
  // so we create and return it.
  // See https://github.com/moxystudio/node-cross-spawn/issues/16
  if (
    status === 1 &&
    (!originalCommand.commandPath || !existsSync(originalCommand.commandPath))
  ) {
    return createEnoentError(originalCommand, syscall);
  }

  return null;
}

/**
 * Create the ENOENT error for the specified command.
 * @param {any} originalCommand The original command information
 * @param {'spawn' | 'spawnSync'} syscall The syscall type, either `'spawn'` or `'spawnSync'`
 * @returns {Error} The ENOENT error
 */
function createEnoentError(
  originalCommand: any,
  syscall: 'spawn' | 'spawnSync',
) {
  return Object.assign(
    new Error(`${syscall} ${originalCommand.commandPath} ENOENT`),
    {
      code: 'ENOENT',
      errno: 'ENOENT',
      syscall: `${syscall} ${originalCommand.commandPath}`,
      path: originalCommand.commandPath,
      spawnargs: originalCommand.args,
    },
  );
}
