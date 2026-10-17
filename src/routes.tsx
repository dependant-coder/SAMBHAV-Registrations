// routes.tsx — all routes per spec §6.1, admin routes lazy-loaded
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminGuard from './pages/admin/guard';

import Home from './pages/Home';
import Register from './pages/Register';
import Success from './pages/Success';
import RequestEdit from './pages/RequestEdit';
import EditDetails from './pages/EditDetails';
import NotFound from './pages/NotFound';

// Admin pages — lazy loaded per spec §4 (code splitting)
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const AdminPages = lazy(() =>
  import('./pages/admin/index').then(m => ({
    default: m.AdminLayout,
  }))
);
const AdminOverview = lazy(() =>
  import('./pages/admin/index').then(m => ({ default: m.AdminOverview }))
);
const AdminMembers = lazy(() =>
  import('./pages/admin/index').then(m => ({ default: m.AdminMembers }))
);
const AdminPending = lazy(() =>
  import('./pages/admin/index').then(m => ({ default: m.AdminPending }))
);
const AdminEditRequests = lazy(() =>
  import('./pages/admin/index').then(m => ({ default: m.AdminEditRequests }))
);
const AdminAllowList = lazy(() =>
  import('./pages/admin/index').then(m => ({ default: m.AdminAllowList }))
);
const AdminSettings = lazy(() =>
  import('./pages/admin/index').then(m => ({ default: m.AdminSettings }))
);

const AdminFallback = () => (
  <div style={{ padding: '2rem', textAlign: 'center' }}>
    <p>Loading admin panel…</p>
  </div>
);

export default function AppRoutes() {
  return (
    <Routes>
      {/* Student routes */}
      <Route path="/" element={<Home />} />
      <Route path="/register/:domainSlug" element={<Register />} />
      <Route path="/success" element={<Success />} />
      <Route path="/request-edit" element={<RequestEdit />} />
      <Route path="/edit" element={<EditDetails />} />

      {/* Admin routes — lazy loaded */}
      <Route
        path="/admin/login"
        element={
          <Suspense fallback={<AdminFallback />}>
            <AdminLogin />
          </Suspense>
        }
      />
      <Route
        path="/admin"
        element={
          <Suspense fallback={<AdminFallback />}>
            <AdminGuard />
          </Suspense>
        }
      >
        <Route
          element={
            <Suspense fallback={<AdminFallback />}>
              <AdminPages />
            </Suspense>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminOverview />
              </Suspense>
            }
          />
          <Route
            path="members"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminMembers />
              </Suspense>
            }
          />
          <Route
            path="pending"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminPending />
              </Suspense>
            }
          />
          <Route
            path="edit-requests"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminEditRequests />
              </Suspense>
            }
          />
          <Route
            path="allow-list"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminAllowList />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminSettings />
              </Suspense>
            }
          />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
