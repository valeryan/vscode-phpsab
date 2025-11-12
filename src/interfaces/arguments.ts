import { GlobPattern } from 'vscode';

/**
 * A whitelist of PHPCS and PHPCBF arguments that is used internally by the extension.
 * This defines all legitimate internal arguments that are passed to PHPCS/PHPCBF.
 *
 * Dev note: Using a class here to easily extract keys for `validInternalArguments` array
 * and simultaneously define the structure of the arguments as an interface.
 * Better than duplicating the list in two places.
 */
class InternalArguments {
  /**
   * @property {string} `--standard` The coding standard to use (e.g., `PSR12`, `MyStandard`, `path/to/ruleset.xml`, `path/to/standard/`)
   */
  '--standard': string;

  /**
   * @property {string} `--stdin-path` The file path to be linted or fixed. Provided by VSCode API.
   */
  '--stdin-path': string;

  /**
   * @property {string} `--report` The report format. Set to `json` for this extension. PHPCS only option.
   */
  '--report': 'json';

  /**
   * @property {unknown} `-q` Quiet mode.
   */
  '-q': unknown;

  /**
   * @property {unknown} `-` Check stdin.
   */
  '-': unknown;
}

/**
 * A whitelist of PHPCS and PHPCBF arguments that users can provide to the extension.
 * This defines all legitimate additional arguments that can be passed to PHPCS/PHPCBF.
 *
 * Dev note: Using a class here to easily extract keys for `validAdditionalArguments` array
 * and simultaneously define the structure of the arguments as an interface.
 * Better than duplicating the list in two places.
 */
class AdditionalArguments {
  /**
   * @property {string} `--filter` Optional filter to limit files processed. Either GitStaged, GitModified, or a path to a custom filter class.
   */
  '--filter'?: string;

  /**
   * @property {GlobPattern} `--ignore` Optional glob pattern(s) to ignore files/directories.
   */
  '--ignore'?: GlobPattern;

  /**
   * @property {number} `--severity` Optional severity level (0-10) to filter messages.
   */
  '--severity'?: number;

  /**
   * @property {number} `--error-severity` Optional error severity level (0-10) to filter error messages.
   */
  '--error-severity'?: number;

  /**
   * @property {number} `--warning-severity` Optional warning severity level (0-10) to filter warning messages.
   */
  '--warning-severity'?: number;
}

/**
 * A type that represents the keys of the PHPCS arguments internally-used.
 */
export type PHPCSInternalArgumentKey = keyof InternalArguments;

/**
 * A type that represents the keys of the additional PHPCS arguments.
 */
export type PHPCSArgumentKey = keyof AdditionalArguments;

/**
 * An array of valid internally-used PHPCS argument keys produced from the `InternalArguments` class.
 * Code based from https://stackoverflow.com/a/59806829/2358222
 */
export const validInternalArguments: PHPCSInternalArgumentKey[] = Object.keys(
  new InternalArguments(),
).map((key) => key as PHPCSInternalArgumentKey);

/**
 * An array of additional valid PHPCS argument keys produced from the `AdditionalArguments` class.
 * Code based from https://stackoverflow.com/a/59806829/2358222
 */
export const validAdditionalArguments: PHPCSArgumentKey[] = Object.keys(
  new AdditionalArguments(),
).map((key) => key as PHPCSArgumentKey);

/**
 * An array of valid additional flags (boolean arguments).
 */
export const validFlags: string[] = ['--ignore-annotations'];

/**
 * Result interface for PHPCS argument validation
 */
export interface PHPCSArgumentValidation {
  /**
   * Whether the arguments are valid
   */
  isValid: boolean;

  /**
   * List of error messages
   */
  errors: string[];
}
