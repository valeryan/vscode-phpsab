export interface ConsoleError extends Error {
  code?: string;

  /**
   * If present, the `cause` property is the underlying cause of the Error. It is used when catching an error and throwing a new one with a different message or code in order to still have access to the original error.
   *
   * Property taken from the generic `Error` class.
   * @see https://nodejs.org/api/errors.html#class-error
   */
  cause?: any;

  /**
   * If present, the `path` property indicates a file system error, and is the file or
   * directory path that caused the error. Especially useful for `ENOENT` errors.
   *
   * Property taken from Node.js `SystemError` class.
   * @see https://nodejs.org/api/errors.html#class-systemerror
   */
  path?: string;
}
