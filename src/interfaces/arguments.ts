type ArgumentKind = 'value' | 'flag';

type ArgumentDefinitionMap = Record<string, ArgumentKind>;

/**
 * Represents the internal PHPCS argument definitions.
 */
type InternalArgumentDefinitions = typeof internalArgumentDefinitions;

/**
 * Represents the additional PHPCS argument definitions.
 */
type AdditionalArgumentDefinitions = typeof additionalArgumentDefinitions;

/**
 * Represents only the no-value PHPCS flags from the user-allowed set.
 * These are the arguments with a `'flag'` kind, such as `--ignore-annotations`.
 */
export type PHPCSFlagArgumentKey = KeysByKind<
  AdditionalArgumentDefinitions,
  'flag'
>;

/**
 * Maps a definition object to the keys whose kind matches the requested argument kind.
 * For example, a map with `--filter: 'value'` and `--ignore-annotations: 'flag'`
 * can produce the union of all `'flag'` keys from that object.
 */
type KeysByKind<
  T extends Record<string, ArgumentKind>,
  K extends ArgumentKind,
> = {
  [P in keyof T]: T[P] extends K ? P : never;
}[keyof T];

/**
 * Returns string keys from an object literal while preserving a narrow string union type.
 */
const keysOf = <T extends object>(obj: T): Array<Extract<keyof T, string>> => {
  return Object.keys(obj) as Array<Extract<keyof T, string>>;
};

/**
 * Filters a definition map down to the keys whose stored kind matches the given kind.
 * The runtime check is simple because each entry is tagged with either `'value'` or `'flag'`.
 */
const keysByKind = <T extends ArgumentDefinitionMap, K extends ArgumentKind>(
  defs: T,
  kind: K,
): Array<KeysByKind<T, K>> => {
  return keysOf(defs).filter((key) => {
    const value = defs[key as keyof T] as ArgumentKind;
    return value === kind;
  }) as unknown as Array<KeysByKind<T, K>>;
};

/**
 * A whitelist of internal PHPCS/PHPCBF argument keys and whether
 * they are key-value args or no-value boolean flags.
 *
 * This defines all legitimate internal arguments that are passed to PHPCS/PHPCBF.
 */
const internalArgumentDefinitions = {
  /**
   * @property {string} `--standard` The coding standard to use
   * (e.g., `PSR12`, `MyStandard`, `path/to/ruleset.xml`, `path/to/standard/`).
   */
  '--standard': 'value',

  /**
   * @property {string} `--stdin-path` The path to the file being linted when using stdin.
   */
  '--stdin-path': 'value',

  /**
   * @property {string} `--report` The report format. Set to `json` for this extension.
   * PHPCS only option.
   */
  '--report': 'value',

  /**
   * @property {boolean} `-q` Quiet mode. Disables progress and verbose output.
   */
  '-q': 'flag',

  /**
   * @property {boolean} `-` Read from stdin.
   */
  '-': 'flag',
} as const satisfies ArgumentDefinitionMap;

/**
 * A whitelist of user-supplied PHPCS/PHPCBF argument keys and whether
 * they are key-value args or no-value boolean flags.
 *
 * This defines all legitimate additional arguments that can be passed to PHPCS/PHPCBF.
 */
const additionalArgumentDefinitions = {
  /**
   * @property {string} `--filter` Optional filter to limit files processed.
   * Either `GitStaged`, `GitModified`, or a path to a custom filter class.
   */
  '--filter': 'value',

  /**
   * @property {string} `--ignore` Optional comma-separated list of glob pattern(s) to ignore
   * files/directories.
   */
  '--ignore': 'value',

  /**
   * @property {string} `--severity` Optional severity level (0-10) of messages to display.
   */
  '--severity': 'value',

  /**
   * @property {string} `--error-severity` Optional severity level (0-10) of
   * error messages to display.
   */
  '--error-severity': 'value',

  /**
   * @property {string} `--warning-severity` Optional severity level (0-10) of
   * warning messages to display.
   */
  '--warning-severity': 'value',

  /**
   * @property {string} `--exclude` Optional comma-separated list of sniffs to exclude.
   */
  '--exclude': 'value',

  /**
   * @property {boolean} `--ignore-annotations` Optional whether to ignore all
   * "phpcs:..." annotations in code comments.
   */
  '--ignore-annotations': 'flag',
} as const satisfies ArgumentDefinitionMap;

/**
 * Represents the keys of the PHPCS arguments internally used by this extension.
 * These are the arguments that must never be exposed to users for override.
 */
export type PHPCSInternalArgumentKey = keyof InternalArgumentDefinitions;

/**
 * Represents the keys of the additional PHPCS arguments that users are allowed to pass.
 */
export type PHPCSAdditionalArgumentKey = keyof AdditionalArgumentDefinitions;

/**
 * A frozen array of internal argument keys passed into PHPCS/PHPCBF by this extension.
 * This ensures validation and filtering logic always has a single source of truth.
 */
export const validInternalArguments: ReadonlyArray<PHPCSInternalArgumentKey> =
  Object.freeze([...keysOf(internalArgumentDefinitions)]);

/**
 * A frozen array of all additional PHPCS/PHPCBF argument keys that
 * are whitelisted and allowed for user-supplied arguments.
 */
export const validAdditionalArguments: ReadonlyArray<PHPCSAdditionalArgumentKey> =
  Object.freeze([...keysOf(additionalArgumentDefinitions)]);

/**
 * A frozen array of additional no-value flags, derived from the definition map.
 * This keeps flag validation aligned with the same metadata used for value-typed arguments.
 */
export const validAdditionalFlagArguments: ReadonlyArray<PHPCSFlagArgumentKey> =
  Object.freeze([...keysByKind(additionalArgumentDefinitions, 'flag')]);

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
