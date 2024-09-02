export const enum PHPCSMessageType {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
}

export interface PHPCSMessage {
  message: string;
  source: string;
  severity: number;
  fixable: boolean;
  type: PHPCSMessageType;
  line: number;
  column: number;
}

export interface PHPCSCounts {
  errors: number;
  warning: number;
  fixable?: number;
}

export interface PHPCSFileStatus extends PHPCSCounts {
  messages: PHPCSMessage[];
}

export interface PHPCSReport {
  totals: PHPCSCounts;
  files: {
    [key: string]: PHPCSFileStatus;
  };
}
