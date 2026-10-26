/**
 * src/pages/lead/EventDetail.tsx   (route /app/lead/events/:id, ?edit=1 opens the editor)
 * Thin wrapper: the screen itself lives in components/EventManager.tsx (shared with the admin panel).
 */
import { useMemo } from 'react';
import EventManager from '../../components/EventManager';
import { DomainSwitcher, useLead } from '../../components/LeadGuard';

export default function LeadEventDetail() {
  const { role, roles } = useLead();
  const ids = useMemo(() => roles.map((r) => r.domain_id), [roles]);
  return <EventManager scope="lead" allowedDomainIds={ids} fallbackDomainName={role.domain_name} header={<DomainSwitcher />} />;
}
