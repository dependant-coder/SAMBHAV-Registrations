// useDraft.ts — persist form data in localStorage with 24h expiry
import { useCallback, useRef } from 'react';
import { DRAFT_TTL_MS } from '../config';

interface DraftEntry<T> {
  data: T;
  savedAt: number;
}

export function useDraft<T>(key: string) {
  const keyRef = useRef(`sambhav_draft_${key}`);

  const load = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(keyRef.current);
      if (!raw) return null;
      const entry: DraftEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(keyRef.current);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }, []);

  const save = useCallback((data: T) => {
    try {
      const entry: DraftEntry<T> = { data, savedAt: Date.now() };
      localStorage.setItem(keyRef.current, JSON.stringify(entry));
    } catch {
      // Storage might be full or unavailable
    }
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(keyRef.current);
  }, []);

  return { load, save, clear };
}
