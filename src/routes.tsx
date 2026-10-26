// routes.tsx — all routes per spec §6.1, admin routes lazy-loaded
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminGuard from './pages/admin/guard';
import MemberGuard from './components/MemberGuard';
import AppShell from './components/AppShell';
import LeadGuard from './components/LeadGuard';
import StaffGuard from './components/StaffGuard';
import IdScanner from './components/IdScanner';

import Home from './pages/Home';
import Register from './pages/Register';
import Success from './pages/Success';
import RequestEdit from './pages/RequestEdit';
import EditDetails from './pages/EditDetails';
import NotFound from './pages/NotFound';
import Creator from './pages/Creator';

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

// Members app (all lazy: students registering never download any of it)
const MemberLogin = lazy(() => import('./pages/member/Login'));
const AuthCallback = lazy(() => import('./pages/member/AuthCallback'));
const MemberHome = lazy(() => import('./pages/member/Home'));
const MemberAnnouncements = lazy(() => import('./pages/member/Announcements'));
const AnnouncementDetail = lazy(() => import('./pages/member/AnnouncementDetail'));
const MemberEvents = lazy(() => import('./pages/member/Events'));
const MemberEventDetail = lazy(() => import('./pages/member/EventDetail'));
const Profile = lazy(() => import('./pages/member/Profile'));
const SetPin = lazy(() => import('./pages/member/SetPin'));
const IdCard = lazy(() => import('./pages/member/IdCard'));
const Scan = lazy(() => import('./pages/member/Scan'));
const VerifyMember = lazy(() => import('./pages/public/VerifyMember'));
const LeadDashboard = lazy(() => import('./pages/lead/Dashboard'));
const LeadMembers = lazy(() => import('./pages/lead/Members'));
const LeadAnnouncements = lazy(() => import('./pages/lead/Announcements'));
const LeadEvents = lazy(() => import('./pages/lead/Events'));
const LeadEventDetail = lazy(() => import('./pages/lead/EventDetail'));

// New admin pages (live in the same admin layout)
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements'));
const AdminEvents = lazy(() => import('./pages/admin/Events'));
const AdminEventDetail = lazy(() => import('./pages/admin/EventDetail'));
const AdminAudit = lazy(() => import('./pages/admin/Audit'));

const MemberFallback = () => (
  <div className="fullscreen-center"><div className="loading-spinner" aria-label="Loading…" /></div>
);

const AdminFallback = () => (
  <div style={{ padding: '2rem', textAlign: 'center' }}>
    <p>Loading admin panel…</p>
  </div>
);

export default function AppRoutes() {
  return (
    <Suspense fallback={<MemberFallback />}>
      <Routes>
        {/* Student routes */}
        <Route path="/" element={<Home />} />
        <Route path="/register/:domainSlug" element={<Register />} />
        <Route path="/success" element={<Success />} />
        <Route path="/request-edit" element={<RequestEdit />} />
        <Route path="/edit" element={<EditDetails />} />
        <Route path="/creator" element={<Creator />} />

        {/* Members app: public */}
        <Route path="/app/login" element={<MemberLogin />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/verify/:publicId" element={<VerifyMember />} />

        {/* Members app: signed-in members */}
        <Route path="/app" element={<MemberGuard />}>
          <Route element={<AppShell />}>
            <Route index element={<MemberHome />} />
            <Route path="announcements" element={<MemberAnnouncements />} />
            <Route path="announcements/:id" element={<AnnouncementDetail />} />
            <Route path="events" element={<MemberEvents />} />
            <Route path="events/:id" element={<MemberEventDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="id" element={<IdCard />} />
            <Route path="lead" element={<LeadGuard />}>
              <Route index element={<LeadDashboard />} />
              <Route path="members" element={<LeadMembers />} />
              <Route path="announcements" element={<LeadAnnouncements />} />
              <Route path="events" element={<LeadEvents />} />
              <Route path="events/:id" element={<LeadEventDetail />} />
            </Route>
          </Route>
          {/* full-screen, outside AppShell */}
          <Route path="set-pin" element={<SetPin />} />
          <Route element={<StaffGuard />}>
            <Route path="scan" element={<Scan />} />
          </Route>
        </Route>

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
          <Route path="scan" element={<IdScanner scope="admin" />} />
          <Route
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminPages />
              </Suspense>
            }
          >
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="events/:id" element={<AdminEventDetail />} />
            <Route path="audit" element={<AdminAudit />} />
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
    </Suspense>
  );
}

