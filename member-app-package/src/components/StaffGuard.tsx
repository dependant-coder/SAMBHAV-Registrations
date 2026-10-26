/**
 * src/components/StaffGuard.tsx
 * For /app/scan: only leads and co-leads. Place it INSIDE <MemberGuard>.
 * (Super admins use /admin/scan, which sits inside the existing admin layout.)
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useMember } from '../contexts/MemberContext';

export default function StaffGuard() {
  const { roles } = useMember();
  if (roles.length === 0) return <Navigate to="/app" replace />;
  return <Outlet />;
}
