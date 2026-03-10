import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

/**
 * Sticky banner shown when an admin is impersonating a user.
 * Detected by the presence of both `admin_token` and `token` in localStorage.
 * Clicking "Back to Admin" clears the user session and redirects to admin testing.
 */
export default function ImpersonationBanner() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show on admin routes — admin is in their own panel
    if (location.pathname.startsWith('/admin')) {
      setVisible(false);
      return;
    }
    const hasAdminToken = !!localStorage.getItem('admin_token');
    const hasUserToken = !!localStorage.getItem('token');
    setVisible(hasAdminToken && hasUserToken);
  }, [location.pathname]);

  if (!visible) return null;

  const handleBackToAdmin = () => {
    // Clear the impersonated user session
    localStorage.removeItem('token');
    localStorage.removeItem('cached_user');
    // Clear user-scoped caches
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('hireabble_')) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    // Purge SW cache (fire-and-forget — don't block navigation)
    try { caches.delete('hireabble-api-v7'); } catch (_) { /* ok */ }
    // Navigate back to admin testing page (full reload to reset React state)
    window.location.href = '/admin/testing';
  };

  return (
    <div className="bg-red-600 text-white text-xs sm:text-sm flex items-center justify-center gap-2 py-1.5 px-4 z-[9999] relative">
      <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="font-medium">Admin impersonation active</span>
      <button
        onClick={handleBackToAdmin}
        className="ml-2 underline font-semibold hover:text-red-100 transition-colors"
      >
        Back to Admin
      </button>
    </div>
  );
}
