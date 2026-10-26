/**
 * src/components/MemberGuard.tsx
 * Wraps every /app/* route except /app/login.
 * loading -> splash, signed out -> login, blocked / pending -> their own screens,
 * temporary PIN -> forced /app/set-pin, otherwise render the page.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMember } from '../contexts/MemberContext';
import { AppFrame, Splash } from './member/ui';
import { BlockedScreen, PendingScreen } from '../pages/member/Blocked';

export default function MemberGuard() {
  const { state, member } = useMember();
  const loc = useLocation();

  if (state.kind === 'loading') return <AppFrame><Splash /></AppFrame>;
  if (state.kind === 'signed_out') return <Navigate to="/app/login" state={{ from: loc }} replace />;
  if (state.kind === 'blocked') return <AppFrame><BlockedScreen /></AppFrame>;
  if (!member) return <AppFrame><Splash /></AppFrame>;
  if (member.status !== 'approved') return <AppFrame><PendingScreen /></AppFrame>;
  if (member.pin_must_change && loc.pathname !== '/app/set-pin') return <Navigate to="/app/set-pin" replace />;
  return <Outlet />;
}
