/**
 * Represents the original executable command data before argument parsing/quoting.
 *
 * This is used by Windows ENOENT handling to report actionable errors
 * with the original command path and arguments.
 */
export interface OriginalCommand {
  /**
   * The absolute or configured path to the executable.
   */
  commandPath: string;

  /**
   * The raw argument array passed to the executable.
   */
  args: string[];
}

/**
 * The mapping of tool executable names to their corresponding service names,
 * i.e., 'phpcs' -> 'sniffer', 'phpcbf' -> 'fixer'.
 */
export const toolNames = {
  phpcs: 'sniffer',
  phpcbf: 'fixer',
} as const satisfies Record<string, string>;

/**
 * Union type representing the executable names ('phpcs' | 'phpcbf').
 */
export type ToolExecutable = keyof typeof toolNames;

/**
 * Union type representing the service tool names ('sniffer' | 'fixer').
 */
export type ToolType = (typeof toolNames)[keyof typeof toolNames];
