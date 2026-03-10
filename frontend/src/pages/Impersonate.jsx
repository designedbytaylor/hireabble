import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

/**
 * Dedicated impersonation route used by admin panel.
 * NOT wrapped in PublicRoute so it works regardless of existing auth state.
 * Clears any stale token first to avoid conflicts.
 */
export default function Impersonate() {
  const { loginWithToken, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect') || '/dashboard';

    if (!token) {
      toast.error('Invalid impersonation link');
      navigate('/login', { replace: true });
      return;
    }

    // Sign out the previous user completely before loading the new one.
    // This resets React auth state, clears localStorage, and purges caches
    // so no stale data from a prior impersonation bleeds through.
    logout();

    loginWithToken(token).then(user => {
      if (user) {
        toast.success(`Logged in as ${user.name}`);
        navigate(redirect, { replace: true });
      } else {
        toast.error('Impersonation failed — user may be banned or suspended');
        navigate('/login', { replace: true });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
