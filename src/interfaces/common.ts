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
