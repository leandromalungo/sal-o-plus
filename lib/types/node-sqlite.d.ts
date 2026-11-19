declare module 'node:sqlite' {
  export type SQLInputValue = null | number | bigint | string | NodeJS.ArrayBufferView;
  export type SQLOutputValue = null | number | bigint | string | Uint8Array;

  export interface StatementSync {
    all(...namedParameters: SQLInputValue[]): Record<string, SQLOutputValue>[];
    get(...namedParameters: SQLInputValue[]): Record<string, SQLOutputValue> | undefined;
    run(...namedParameters: SQLInputValue[]): {
      changes: number | bigint;
      lastInsertRowid: number | bigint;
    };
  }

  export class DatabaseSync {
    constructor(location: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
