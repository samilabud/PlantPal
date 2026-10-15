import { useEffect, useState } from 'react';
import { create } from 'zustand';

import { getDb } from '@/db/database';
import type { SqlDb } from '@/db/types';

/**
 * A tiny "live query": screens read straight from SQLite and re-read whenever local data
 * changes (a local write or a finished sync bumps `version`). React Query is kept for
 * server-only data (profile, photo URLs).
 */
export const useDataVersion = create<{ version: number; bump: () => void }>()((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export const notifyDataChanged = () => useDataVersion.getState().bump();

export function useLiveQuery<T>(query: (db: SqlDb) => Promise<T>, deps: unknown[]) {
  const version = useDataVersion((s) => s.version);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    getDb()
      .then(query)
      .then(
        (result) => alive && (setData(result), setError(null)),
        (e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))),
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  return { data, error, loading: data === undefined && !error };
}
