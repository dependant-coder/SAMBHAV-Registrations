/**
 * src/contexts/MemberContext.tsx
 * Who is signed in, which member they are, their roles, and the unread count.
 * State machine: loading -> signed_out | blocked | ready   (plan section 3.2)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { cacheClearAll, cacheGet, cacheKey, cacheSet } from '../lib/cache';

export type MyMember = {
  id: string;
  name: string;
  roll_number: string;
  email: string;
  status: string;
  photo_path: string | null;
  domain_id: string | null;
  domain_name: string | null;
  domain_slug: string | null;
  has_pin: boolean;
  pin_must_change: boolean;
  public_id: string;
  member_no: number;
  joined_at: string;
  role: 'lead' | 'colead' | null;
};

export type MyRole = { domain_id: string; domain_name: string; role: 'lead' | 'colead' };

export type BlockedReason = 'not_found' | 'ambiguous' | 'already_linked' | 'unverified' | 'error';

export type MemberState =
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | { kind: 'blocked'; reason: BlockedReason; email: string | null; isAdmin: boolean }
  | { kind: 'ready' };

type Ctx = {
  state: MemberState;
  member: MyMember | null;
  roles: MyRole[];
  unread: number;
  /** true when the profile shown came from the offline cache */
  stale: boolean;
  refresh: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  signOut: () => Promise<void>;
};

const MemberCtx = createContext<Ctx | null>(null);

const LAST_KEY = 'sx:v1:lastMember';
const isNetworkError = (e: unknown) =>
  !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(String((e as Error)?.message ?? e));

export function MemberProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MemberState>({ kind: 'loading' });
  const [member, setMember] = useState<MyMember | null>(null);
  const [roles, setRoles] = useState<MyRole[]>([]);
  const [unread, setUnread] = useState(0);
  const [stale, setStale] = useState(false);
  const reqId = useRef(0);
  const lastLoad = useRef(0);
  const memberRef = useRef<MyMember | null>(null);
  memberRef.current = member;

  const refreshUnread = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        supabase.from('announcements').select('id, published_at, expires_at').order('published_at', { ascending: false }).limit(100),
        supabase.from('announcement_reads').select('announcement_id'),
      ]);
      if (a.error || r.error) return;
      const read = new Set((r.data ?? []).map((x) => x.announcement_id as string));
      const now = Date.now();
      const n = (a.data ?? []).filter((x) =>
        new Date(x.published_at).getTime() <= now && (!x.expires_at || new Date(x.expires_at).getTime() > now) && !read.has(x.id as string),
      ).length;
      setUnread(n);
    } catch { /* badge is optional */ }
  }, []);

  /** silent = keep the current screen while re-checking (visibility refresh) */
  const load = useCallback(async (silent = false) => {
    const my = ++reqId.current;
    const stillMine = () => my === reqId.current;
    if (!silent) setState({ kind: 'loading' });
    lastLoad.current = Date.now();

    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!stillMine()) return;
      const user = sess.session?.user;
      if (!user) {
        setMember(null); setRoles([]); setUnread(0);
        setState({ kind: 'signed_out' });
        return;
      }

      const { data: claim, error: claimErr } = await supabase.rpc('claim_member');
      if (!stillMine()) return;
      if (claimErr) throw claimErr;

      const result = (claim as { result?: string } | null)?.result;
      if (result !== 'ok') {
        const reason: BlockedReason =
          result === 'not_found' ? 'not_found'
            : result === 'ambiguous' ? 'ambiguous'
              : result === 'already_linked' ? 'already_linked'
                : result === 'unverified_email' ? 'unverified'
                  : result === 'no_session' ? 'not_found' : 'error';
        let isAdmin = false;
        if (reason === 'not_found') {
          const { data } = await supabase.rpc('is_admin');
          isAdmin = data === true;
        }
        if (!stillMine()) return;
        setMember(null); setRoles([]);
        setState({ kind: 'blocked', reason, email: user.email ?? null, isAdmin });
        return;
      }

      const { data: prof, error: profErr } = await supabase.rpc('get_my_profile');
      if (!stillMine()) return;
      if (profErr) throw profErr;
      if (!prof) {
        setMember(null); setRoles([]);
        setState({ kind: 'blocked', reason: 'not_found', email: user.email ?? null, isAdmin: false });
        return;
      }
      const p = prof as MyMember;

      let rl: MyRole[] = [];
      if (p.status === 'approved') {
        const { data: rdata } = await supabase.rpc('get_my_roles');
        if (!stillMine()) return;
        rl = Array.isArray(rdata) ? (rdata as MyRole[]) : [];
      }

      setMember(p); setRoles(rl); setStale(false);
      setState({ kind: 'ready' });
      cacheSet(cacheKey(p.id, 'profile'), p);
      try { localStorage.setItem(LAST_KEY, p.id); } catch { /* ignore */ }
      if (p.status === 'approved') void refreshUnread();
    } catch (e) {
      if (!stillMine()) return;
      // Offline: show the last saved profile instead of an error screen
      if (isNetworkError(e)) {
        let id: string | null = null;
        try { id = localStorage.getItem(LAST_KEY); } catch { /* ignore */ }
        const cached = id ? cacheGet<MyMember>(cacheKey(id, 'profile')) : null;
        if (cached) {
          setMember(cached); setStale(true);
          setState({ kind: 'ready' });
          return;
        }
      }
      if (silent && memberRef.current) return;   // keep what we have
      setState({ kind: 'blocked', reason: 'error', email: null, isAdmin: false });
    }
  }, [refreshUnread]);

  // first load + auth changes
  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Never call supabase methods directly inside this callback (can deadlock): defer.
      if (event === 'SIGNED_OUT') {
        reqId.current++;
        setMember(null); setRoles([]); setUnread(0);
        setState({ kind: 'signed_out' });
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') setTimeout(() => { void load(); }, 0);
      // TOKEN_REFRESHED / INITIAL_SESSION: nothing to do, load() above already ran
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  // re-check profile + roles when the app comes back to the foreground (revoked roles vanish quickly)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastLoad.current < 30_000) return;
      if (memberRef.current) void load(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const signOut = useCallback(async () => {
    // order matters: deleting the push subscription needs the session
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
      }
    } catch { /* offline or unsupported: still sign out */ }
    cacheClearAll();
    try { localStorage.removeItem(LAST_KEY); } catch { /* ignore */ }
    try { await supabase.auth.signOut(); } catch { /* local session is cleared below */ }
    reqId.current++;
    setMember(null); setRoles([]); setUnread(0); setStale(false);
    setState({ kind: 'signed_out' });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ state, member, roles, unread, stale, refresh, refreshUnread, signOut }),
    [state, member, roles, unread, stale, refresh, refreshUnread, signOut],
  );
  return <MemberCtx.Provider value={value}>{children}</MemberCtx.Provider>;
}

export function useMember() {
  const c = useContext(MemberCtx);
  if (!c) throw new Error('useMember must be used inside <MemberProvider>');
  return c;
}

/** For pages that only render when the guard says ready. */
export function useReadyMember() {
  const c = useMember();
  if (!c.member) throw new Error('useReadyMember used outside MemberGuard');
  return { ...c, member: c.member };
}
