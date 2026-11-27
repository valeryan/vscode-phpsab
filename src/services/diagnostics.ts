import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  languages,
  Range,
  TextDocument,
} from 'vscode';
import {
  PHPCSCounts,
  PHPCSFileStatus,
  PHPCSMessage,
  PHPCSMessageType,
  PHPCSReport,
} from '../interfaces/phpcs-report';
import { Settings } from '../interfaces/settings';

/**
 * The collection of diagnostics for PHP files, used to
 * display linting errors and warnings in the editor.
 * @type {DiagnosticCollection}
 */
const diagnosticCollection: DiagnosticCollection =
  languages.createDiagnosticCollection('php');

/**
 * Builds diagnostics from PHPCS stdout and updates the diagnostic collection
 * for the given document. Clears old diagnostics if the report is invalid.
 *
 * @param {string} stdout The raw JSON stdout from PHPCS.
 * @param {TextDocument} document The document being validated.
 * @param {Settings} settings The current extension settings.
 * @throws {Error} If the report cannot be parsed or is invalid.
 */
export const constructDiagnostics = (
  stdout: string,
  document: TextDocument,
  settings: Settings,
): void => {
  // Attempt to build diagnostics or clear the document diagnostics.
  try {
    const parsedReport: unknown = JSON.parse(stdout);
    // Validate that the parsed report is a valid PHPCS report, otherwise throw an error.
    if (!isPHPCSReport(parsedReport)) {
      throw new Error('Invalid PHPCS report.');
    }

    // Build diagnostics from the validated PHPCS report.
    const build_diagnostics = buildDiagnostics(parsedReport, settings);
    // Update the diagnostic collection with the newly built diagnostics.
    diagnosticCollection.set(document.uri, build_diagnostics);
  } catch (error) {
    // Clear the diagnostics for the document if an error occurs, and rethrow the error.
    clearDocumentDiagnostics(document);
    throw error instanceof Error ? error : new Error(String(error));
  }
};

/**
 * Builds an array of VS Code diagnostics from a validated PHPCS report.
 * @param {PHPCSReport} report The validated PHPCS report.
 * @param {Settings} settings The current extension settings.
 * @returns {Diagnostic[]} An array of VS Code diagnostics built from the PHPCS report.
 */
const buildDiagnostics = (
  report: PHPCSReport,
  settings: Settings,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  // Iterate over each file in the PHPCS report and build diagnostics for each message.
  for (const file of Object.values(report.files)) {
    for (const entry of file.messages) {
      // Destructure the relevant fields from the PHPCS message entry into separate variables.
      const { message, line, column, type, source, fixable } = entry;

      // Determine the diagnostic severity based on the PHPCS message type.
      const diagnosticSeverity =
        type === PHPCSMessageType.ERROR
          ? DiagnosticSeverity.Error
          : DiagnosticSeverity.Warning;

      let output = message;

      // If showing fixability icons is enabled, append them to the output message.
      if (settings.snifferShowFixabilityIcons) {
        output += `\nAuto-fixable: ${fixable ? '✔️' : '❌'}`;
      }

      // Create a range for the diagnostic using the line and column from the PHPCS message.
      const range = createRangeFromPHPCSMessage(line, column);

      // Create the diagnostic object.
      const diagnostic = new Diagnostic(range, output, diagnosticSeverity);

      // Set the source of the diagnostic to indicate it comes from PHPCS.
      diagnostic.source = '\nphpcs';

      // If showing sources is enabled, add the sniff source as the diagnostic code,
      // to show the sniff code alongside the diagnostic message.
      if (settings.snifferShowSources) {
        diagnostic.code = source;
      }

      // Add the diagnostic to the collection.
      diagnostics.push(diagnostic);
    }
  }

  return diagnostics;
};

/**
 * Creates a VS Code Range object from the 1-based line
 * and column numbers provided by a PHPCS message.
 * @param {number} line The line number.
 * @param {number} column The column number.
 * @returns {Range} A VS Code Range object.
 */
const createRangeFromPHPCSMessage = (line: number, column: number): Range => {
  // Convert 1-based line and column numbers from PHPCS to 0-based (just minus by 1).
  const zeroLine = line - 1;
  const zeroColumn = column - 1;

  // Create a range for the diagnostic using the zero-based line and column numbers.
  return new Range(zeroLine, zeroColumn, zeroLine, zeroColumn);
};

/**
 * Checks if a given report is a valid PHPCS report with the required structure and fields.
 * @param {unknown} report The report to check.
 * @returns {boolean} `true` if the report is a valid PHPCS report, `false` otherwise.
 */
const isPHPCSReport = (report: unknown): report is PHPCSReport => {
  // Validate that the report has the basic structure, if it doesn't, return false.
  if (
    !isRecord(report) ||
    !isPHPCSCounts(report.totals) ||
    !isRecord(report.files)
  ) {
    return false;
  }

  // Check each file in the report has a valid PHPCS file status and
  // return true only if all files are valid.
  return Object.values(report.files).every(isPHPCSFileStatus);
};

/**
 * Checks if a given file has a valid PHPCS file status.
 * @param {unknown} file The file to check.
 * @returns {boolean} `true` if the file has a valid PHPCS file status, `false` otherwise.
 */
const isPHPCSFileStatus = (file: unknown): file is PHPCSFileStatus => {
  // If the file is not a record or does not have valid PHPCS counts, return false.
  if (!isRecord(file) || !isPHPCSCounts(file)) {
    return false;
  }
  // Ensure the file has a messages array and that each message is valid,
  // and return true only if all messages are valid.
  return Array.isArray(file.messages) && file.messages.every(isPHPCSMessage);
};

/**
 * Checks if a given object has valid PHPCS counts.
 * @param {unknown} counts The counts object to check.
 * @returns {boolean} `true` if the counts object has valid PHPCS counts, `false` otherwise.
 */
const isPHPCSCounts = (counts: unknown): counts is PHPCSCounts => {
  // If the counts object is not a record, return false.
  if (!isRecord(counts)) {
    return false;
  }

  // Ensure the counts object has valid error, warning, and the optional fixable counts.
  return (
    isIntegerGreaterThanOrEqualTo(counts.errors, 0) &&
    isIntegerGreaterThanOrEqualTo(counts.warnings, 0) &&
    (counts.fixable === undefined ||
      isIntegerGreaterThanOrEqualTo(counts.fixable, 0))
  );
};

/**
 * Checks if a given entry is a valid PHPCS message.
 * @param {unknown} entry The entry to check.
 * @returns {boolean} `true` if the entry is a valid PHPCS message, `false` otherwise.
 */
const isPHPCSMessage = (entry: unknown): entry is PHPCSMessage => {
  // If the entry is not a record, return false.
  if (!isRecord(entry)) {
    return false;
  }

  // Ensure the entry has valid details, severity, type, line and column numbers.
  return (
    hasValidDetails(entry) &&
    hasValidSeverity(entry) &&
    hasValidType(entry) &&
    hasValidLineNumber(entry) &&
    hasValidColumnNumber(entry)
  );
};

/**
 * Checks if an entry has valid PHPCS message details,
 * which include the message, source, and fixable properties.
 * @param {unknown} entry The entry to check.
 * @returns {boolean} `true` if the entry has valid details, `false` otherwise.
 */
const hasValidDetails = (entry: unknown): boolean => {
  return (
    isRecord(entry) &&
    typeof entry.message === 'string' &&
    typeof entry.source === 'string' &&
    typeof entry.fixable === 'boolean'
  );
};

/**
 * Checks if an entry has a valid severity.
 * Note: `severity` isn't used in the diagnostics, but it is
 * included in the PHPCS report, so we still need to validate it.
 * @param {unknown} entry The entry to check.
 * @returns {boolean} `true` if the entry has a valid severity, `false` otherwise.
 */
const hasValidSeverity = (entry: unknown): boolean => {
  return (
    isRecord(entry) &&
    isInteger(entry.severity) &&
    entry.severity >= 0 &&
    entry.severity <= 10
  );
};

/**
 * Checks if an entry has a valid type, either `ERROR` or `WARNING`.
 * @param {unknown} entry The entry to check.
 * @returns {boolean} `true` if the entry has a valid type, `false` otherwise.
 */
const hasValidType = (entry: unknown): boolean => {
  return (
    isRecord(entry) &&
    (entry.type === PHPCSMessageType.ERROR ||
      entry.type === PHPCSMessageType.WARNING)
  );
};

/**
 * Checks if an entry has a valid line number.
 * @param {unknown} entry The entry to check.
 * @returns {boolean} `true` if the entry has a valid line, `false` otherwise.
 */
const hasValidLineNumber = (entry: unknown): boolean =>
  isRecord(entry) && isIntegerGreaterThanOrEqualTo(entry.line, 1);

/**
 * Checks if an entry has a valid column number.
 * @param {unknown} entry The entry to check.
 * @returns {boolean} `true` if the entry has a valid column, `false` otherwise.
 */
const hasValidColumnNumber = (entry: unknown): boolean =>
  isRecord(entry) && isIntegerGreaterThanOrEqualTo(entry.column, 1);

/**
 * Checks if a value is a non-null object and not an array.
 * @param {unknown} value The value to check.
 * @returns {boolean} `true` if the value is a non-null object and not an array, `false` otherwise.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Checks if a value is an integer greater than or equal to a specified minimum.
 * @param {unknown} value The value to check.
 * @param {number} min The minimum value.
 * @returns {boolean} `true` if the value is an integer greater than or equal to the minimum, `false` otherwise.
 */
const isIntegerGreaterThanOrEqualTo = (value: unknown, min: number): boolean =>
  isInteger(value) && value >= min;

/**
 * Checks if a value is an integer.
 * @param {unknown} value The value to check.
 * @returns {boolean} `true` if the value is an integer, `false` otherwise.
 */
const isInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

/**
 * Clears diagnostics from a document.
 * @param {TextDocument} document The document to clear diagnostics from.
 */
export const clearDocumentDiagnostics = (document: TextDocument): void => {
  diagnosticCollection.delete(document.uri);
};

/**
 * Clears all diagnostics from the diagnostic collection.
 */
export const clearAllDiagnostics = (): void => {
  diagnosticCollection.clear();
};

/**
 * Disposes of the diagnostic collection, freeing up any resources it holds.
 */
export const disposeDiagnostics = (): void => {
  diagnosticCollection.dispose();
};
