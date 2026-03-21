import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, User, Briefcase, MessageCircle, BarChart3, Bookmark, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Prefetch route data on hover/touch to make navigation feel instant
const prefetchedRoutes = new Set();
const prefetchRoute = (path, token) => {
  if (prefetchedRoutes.has(path) || !token) return;
  prefetchedRoutes.add(path);

  const headers = { Authorization: `Bearer ${token}` };
  const opts = { headers, timeout: 5000 };

  // Prefetch the data each route needs
  if (path === '/dashboard') {
    axios.get(`${API}/jobs`, opts).catch(() => {});
    axios.get(`${API}/stats`, opts).catch(() => {});
  } else if (path === '/recruiter') {
    axios.get(`${API}/applications/recruiter`, opts).catch(() => {});
    axios.get(`${API}/stats`, opts).catch(() => {});
  } else if (path === '/matches') {
    axios.get(`${API}/matches`, opts).catch(() => {});
  } else if (path === '/messages') {
    axios.get(`${API}/matches`, opts).catch(() => {});
  } else if (path === '/applied') {
    axios.get(`${API}/applications/seeker`, opts).catch(() => {});
  } else if (path === '/saved') {
    axios.get(`${API}/jobs/saved`, opts).catch(() => {});
  }
};

export default memo(function Navigation() {
  const location = useLocation();
  const { user, token } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/messages/unread/count`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      setUnreadMessages(res.data.unread_count || 0);
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Refresh count when navigating to messages page (clears on visit)
  useEffect(() => {
    if (location.pathname === '/messages' || location.pathname.startsWith('/chat/')) {
      const timer = setTimeout(fetchUnreadCount, 2000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, fetchUnreadCount]);

  const isSeeker = user?.role === 'seeker';

  const navItems = useMemo(() => [
    {
      isLogo: true,
      label: 'Home',
      path: isSeeker ? '/dashboard' : '/recruiter'
    },
    ...(isSeeker ? [{
      icon: Bookmark,
      label: 'Saved',
      path: '/saved'
    }, {
      icon: Briefcase,
      label: 'Applied',
      path: '/applied'
    }] : [{
      icon: BarChart3,
      label: 'Dashboard',
      path: '/recruiter/dashboard'
    }]),
    {
      icon: Sparkles,
      label: 'Opportunities',
      path: '/matches'
    },
    {
      icon: MessageCircle,
      label: 'Messages',
      path: '/messages',
      badge: unreadMessages
    },
  ], [isSeeker, unreadMessages]);

  return (
    <nav className="fixed left-1/2 transform -translate-x-1/2 z-50" style={{ bottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }} aria-label="Main navigation" role="navigation">
      <div className="glass rounded-full px-4 py-2.5 flex items-center gap-4" role="menubar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              role="menuitem"
              aria-label={item.badge > 0 ? `${item.label} (${item.badge} unread)` : item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 transition-all relative ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
              onMouseEnter={() => prefetchRoute(item.path, token)}
              onTouchStart={() => prefetchRoute(item.path, token)}
            >
              <div className={`p-2 rounded-xl transition-all relative ${
                isActive ? 'bg-primary/20 neon-glow' : 'hover:bg-accent'
              }`}>
                {item.isLogo ? (
                  <svg viewBox="0 0 512 512" className="w-5 h-5" fill="currentColor">
                    <path d="M290 56L168 272h96L216 456l176-240h-108L290 56z"/>
                  </svg>
                ) : (
                  <Icon className="w-5 h-5" />
                )}
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium hidden md:block">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
})
