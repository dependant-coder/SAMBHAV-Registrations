// ============================================================
// AppContext.tsx — loads domains, branches, settings once at startup
// ============================================================
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { fetchDomains, fetchBranches, fetchSettings, type Domain, type Branch, type Settings } from '../lib/api';
import { daysUntil } from '../lib/dates';

interface AppState {
  domains: Domain[];
  branches: Branch[];
  settings: Settings | null;
  loading: boolean;
  error: Error | null;
  registrationIsOpen: boolean;
  deadlineIsNear: boolean; // within 3 days
  retry: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, b, s] = await Promise.all([
        fetchDomains(),
        fetchBranches(),
        fetchSettings(),
      ]);
      setDomains(d);
      setBranches(b);
      setSettings(s);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const registrationIsOpen = useMemo(() => {
    if (!settings) return true;
    return (
      settings.registration_open &&
      (settings.registration_deadline == null ||
        new Date(settings.registration_deadline).getTime() > Date.now())
    );
  }, [settings]);

  const deadlineIsNear = settings?.registration_deadline
    ? daysUntil(settings.registration_deadline) <= 3 &&
      daysUntil(settings.registration_deadline) >= 0
    : false;

  return (
    <AppContext.Provider
      value={{
        domains,
        branches,
        settings,
        loading,
        error,
        registrationIsOpen,
        deadlineIsNear,
        retry: load,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
