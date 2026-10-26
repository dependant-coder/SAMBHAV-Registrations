/**
 * src/hooks/useLoad.ts
 * Load data, keep the last good copy in localStorage, and show it when offline or on error.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMember } from '../contexts/MemberContext';
import { cacheGet, cacheKey, cacheSet } from '../lib/cache';

export function useLoad<T>(cacheName: string | null, fn: () => Promise<T>, deps: unknown[] = []) {
  const { member } = useMember();
  const mid = member?.id ?? null;
  const key = cacheName && mid ? cacheKey(mid, cacheName) : null;

  const [data, setData] = useState<T | null>(() => (key ? cacheGet<T>(key) : null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fromCache, setFromCache] = useState(() => !!(key && cacheGet<T>(key)));
  const req = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const my = ++req.current;
    setLoading(true); setError(false);
    try {
      const v = await fnRef.current();
      if (my !== req.current) return;
      setData(v); setFromCache(false);
      if (key) cacheSet(key, v);
    } catch {
      if (my !== req.current) return;
      setError(true);
    } finally {
      if (my === req.current) setLoading(false);
    }
  }, [key]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, [reload, ...deps]);
  useEffect(() => {
    const on = () => void reload();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [reload]);

  return { data, setData, loading, error, fromCache, reload };
}
