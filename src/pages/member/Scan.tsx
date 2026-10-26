/**
 * src/pages/member/Scan.tsx   (route /app/scan, inside MemberGuard + StaffGuard, OUTSIDE AppShell: full-screen dark)
 * For the super admin, mount <IdScanner scope="admin" /> at /admin/scan inside your existing admin layout.
 */
import IdScanner from '../../components/IdScanner';

export default function Scan() {
  return <IdScanner scope="lead" />;
}
