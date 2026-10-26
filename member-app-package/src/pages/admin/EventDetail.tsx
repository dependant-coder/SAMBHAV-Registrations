/**
 * src/pages/admin/EventDetail.tsx   (route /admin/events/:id, ?edit=1 opens the editor)
 * Thin wrapper: the screen itself lives in components/EventManager.tsx (shared with the lead app).
 */
import AdminFrame from '../../components/admin/AdminFrame';
import EventManager from '../../components/EventManager';

export default function AdminEventDetail() {
  return <AdminFrame><EventManager scope="admin" /></AdminFrame>;
}
