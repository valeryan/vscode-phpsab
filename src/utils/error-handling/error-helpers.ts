/**
 * Get the regex to match the error message when the `php` command is not found.
 *
 * ---
 *
 * Note:
 *
 * The regex is designed to match the various different OS and shell error messages
 * that indicate the `php` command is not found.
 * The regex is flexible to accommodate some of the most common formats of "command not found"
 * errors. But there may be some edge cases where some OS and shells may
 * have different formats than those described here. Those edge cases should be added to the
 * regex as and when they occur.
 *
 * The final regex will match an error message in part or in whole, and
 * with or without single or double quotes around `php`, and with or without a colon.
 *
 * The command error formats (without quotes) are as follows:
 *
 * 1. php is not recognized
 * 2. php: command not found
 * 3. php cannot be found
 * 4. command not found: php
 * 5. Unknown command php
 *
 * The final regex can be seen in action here: https://regex101.com/r/Ob1YKB
 */
export const getPhpNotFoundRegex = (): RegExp => {
  // Match 'php' with optional quotes
  const php = `["']?php["']?`;

  // Match optional colon and/or whitespace separators
  const separator = `[:\\s]*`;

  // Error message patterns that indicate php command is not found
  const errorPatterns = [
    'is\\s+not\\s+recognized',
    'command\\s+not\\s+found',
    'cannot\\s+be\\s+found',
    'unknown\\s+command',
  ];

  // Join error patterns into a single group.
  const error = `(${errorPatterns.join(`|`)})`;
  // Build regex to match php before error OR php after error.
  const pattern = `(${php}${separator})?${error}(${separator}${php})?`;

  const regex = new RegExp(pattern, 'i');

  return regex;
};
