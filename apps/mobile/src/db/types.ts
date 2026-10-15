/**
 * The small slice of expo-sqlite the app uses. Keeping it as an interface lets the same
 * repository and sync code run on the phone (expo-sqlite) and in Jest (better-sqlite3).
 */
export type Bind = string | number | null;

export interface SqlDb {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: Bind[]): Promise<{ changes: number }>;
  getAllAsync<T>(source: string, params: Bind[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: Bind[]): Promise<T | null>;
  /** Only queries made on `tx` run inside the transaction (expo-sqlite "exclusive" semantics). */
  withExclusiveTransactionAsync(task: (tx: SqlDb) => Promise<void>): Promise<void>;
}
