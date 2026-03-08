import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Heart, User, Briefcase, MessageCircle, BarChart3, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
      icon: Home,
      label: 'Home',
      path: isSeeker ? '/dashboard' : '/recruiter'
    },
    ...(isSeeker ? [{
      icon: Briefcase,
      label: 'Applied',
      path: '/applied'
    }] : [{
      icon: BarChart3,
      label: 'Dashboard',
      path: '/recruiter/dashboard'
    }]),
    {
      icon: Heart,
      label: 'Matches',
      path: '/matches'
    },
    {
      icon: MessageCircle,
      label: 'Messages',
      path: '/messages',
      badge: unreadMessages
    },
    ...(isSeeker ? [{
      icon: Calendar,
      label: 'Interviews',
      path: '/interviews'
    }] : []),
    {
      icon: User,
      label: 'Profile',
      path: '/profile'
    },
  ], [isSeeker, unreadMessages]);

  return (
    <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="glass rounded-full px-4 py-3 flex items-center gap-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 transition-all relative ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <div className={`p-2 rounded-xl transition-all relative ${
                isActive ? 'bg-primary/20 neon-glow' : 'hover:bg-accent'
              }`}>
                <Icon className="w-5 h-5" />
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
