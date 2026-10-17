// guard.tsx — AdminGuard wraps all /admin/* routes except /admin/login
import { useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAdmin } from '../../contexts/AdminContext';
import { supabase } from '../../lib/supabase';

export default function AdminGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, loading } = useAdmin();

  // Subscribe to auth state changes — redirect on sign-out
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/admin/login', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Redirect when not loading and no user
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/admin/login', { replace: true });
      return;
    }
    if (!isAdmin) {
      navigate('/admin/login', {
        replace: true,
        state: { message: "This account doesn't have admin access." },
      });
    }
  }, [loading, user, isAdmin, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="fullscreen-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    // Will redirect via effect; render nothing in the meantime
    return null;
  }

  return <Outlet />;
}
