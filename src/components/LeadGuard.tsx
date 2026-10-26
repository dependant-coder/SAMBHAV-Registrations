/**
 * src/components/LeadGuard.tsx
 * Wraps /app/lead/*. No role -> back to /app. If someone leads several domains, DomainSwitcher lets them pick.
 * Roles are re-checked from the server every time this guard mounts (revoked roles disappear quickly).
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useMember } from '../contexts/MemberContext';
import type { MyRole } from '../contexts/MemberContext';

type Ctx = { role: MyRole; roles: MyRole[]; setDomainId: (id: string) => void };
const LeadCtx = createContext<Ctx | null>(null);

export function useLead() {
  const c = useContext(LeadCtx);
  if (!c) throw new Error('useLead must be used inside <LeadGuard>');
  return c;
}

export default function LeadGuard() {
  const { roles, refresh } = useMember();
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => { void refresh(); }, [refresh]);

  const role = roles.find((r) => r.domain_id === picked) ?? roles[0];
  const value = useMemo<Ctx | null>(() => (role ? { role, roles, setDomainId: setPicked } : null), [role, roles]);

  if (!value) return <Navigate to="/app" replace />;
  return <LeadCtx.Provider value={value}><Outlet /></LeadCtx.Provider>;
}

export function DomainSwitcher() {
  const { role, roles, setDomainId } = useLead();
  if (roles.length < 2) return null;
  return (
    <div className="control" style={{ marginTop: 12 }}>
      <select
        className="input" aria-label="Domain" value={role.domain_id} onChange={(e) => setDomainId(e.target.value)}
        style={{ paddingRight: 18 }}
      >
        {roles.map((r) => <option key={r.domain_id} value={r.domain_id}>{r.domain_name} · {r.role === 'lead' ? 'Lead' : 'Co-lead'}</option>)}
      </select>
    </div>
  );
}
