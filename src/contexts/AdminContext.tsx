// ============================================================
// AdminContext.tsx — admin session state
// ============================================================
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AdminState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AdminContext = createContext<AdminState | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async (u: User | null) => {
    if (!u) { setIsAdmin(false); return; }
    try {
      const { data } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', u.id)
        .single();
      setIsAdmin(Boolean(data));
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    try {
      supabase.auth.getSession().then(({ data }) => {
        const u = data?.session?.user ?? null;
        setUser(u);
        checkAdmin(u).finally(() => setLoading(false));
      }).catch(() => {
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        checkAdmin(u);
      });

      return () => subscription.unsubscribe();
    } catch {
      setLoading(false);
    }
  }, [checkAdmin]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AdminContext.Provider value={{ user, isAdmin, loading, signOut }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminState {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
