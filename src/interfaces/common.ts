/**
 * Represents the original executable command data before argument parsing/quoting.
 *
 * This is used by Windows ENOENT handling to report actionable errors
 * with the original command path and arguments.
 */
export interface OriginalCommand {
  /** Absolute or configured path to the executable command. */
  commandPath: string;

  /** Raw argument array passed to the executable. */
  args: string[];
}
