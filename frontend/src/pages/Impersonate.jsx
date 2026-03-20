import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

/**
 * Dedicated impersonation route used by admin panel.
 * NOT wrapped in PublicRoute so it works regardless of existing auth state.
 * loginWithToken handles all cleanup (abort in-flight auth, clear caches, etc.)
 */
export default function Impersonate() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const impersonateToken = searchParams.get('token');
    const rawRedirect = searchParams.get('redirect') || '/dashboard';
    // Prevent open redirect - only allow relative paths
    const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.includes('://')
      ? rawRedirect
      : '/dashboard';

    if (!impersonateToken) {
      toast.error('Invalid impersonation link');
      navigate('/login', { replace: true });
      return;
    }

    // loginWithToken handles all cleanup internally:
    // 1. Aborts any in-flight auth init
    // 2. Clears cached_user and all hireabble_ localStorage keys
    // 3. Purges ALL SW caches (api + static + images)
    // 4. Sets the new token and fetches /auth/me
    // Do NOT call logout() — it causes a race condition where
    // setToken(null) triggers authInit useEffect competing with loginWithToken.
    loginWithToken(impersonateToken).then(result => {
      if (result && !result._error) {
        toast.success(`Logged in as ${result.name}`);
        navigate(redirect, { replace: true });
      } else {
        const detail = result?._error ? `(${result.status}: ${result.detail})` : '';
        toast.error(`Impersonation failed ${detail}`.trim());
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
