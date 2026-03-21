import { useState, useEffect, useRef } from 'react';
import { Bell, Rocket, MessageSquare, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NotificationBell() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/notifications/unread/count`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/notifications?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBellClick = () => {
    if (!isOpen) {
      fetchNotifications();
      // Auto-mark all as read when opening the bell
      if (unreadCount > 0) {
        markAllAsRead();
      }
    }
    setIsOpen(!isOpen);
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    
    // Navigate based on notification type
    if (notification.type === 'match') {
      navigate('/matches');
    } else if (notification.type === 'message' && notification.data?.match_id) {
      navigate(`/chat/${notification.data.match_id}`);
    } else if (notification.type === 'interview') {
      navigate('/interviews');
    } else if (notification.type === 'reference_request') {
      navigate('/profile');
    } else if (notification.type === 'recruiter_interest' && notification.data?.recruiter_id) {
      navigate(`/company/${notification.data.recruiter_id}`);
    } else if (notification.type === 'application') {
      navigate('/recruiter/pipeline');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'match':
        return <Rocket className="w-4 h-4 text-green-500" />;
      case 'message':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'application':
        return <Briefcase className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-xl hover:bg-accent transition-colors"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 w-auto sm:w-80 max-h-96 overflow-hidden rounded-2xl bg-card border border-border shadow-xl z-[60]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-accent/30">
            <h3 className="font-semibold text-sm">Notifications</h3>
          </div>

          {/* Notification List */}
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bell className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left border-b border-border/50 last:border-0 ${
                    !notification.is_read ? 'bg-primary/5' : ''
                  }`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    notification.type === 'match' ? 'bg-green-500/10' :
                    notification.type === 'message' ? 'bg-blue-500/10' : 'bg-purple-500/10'
                  }`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${!notification.is_read ? 'font-medium' : ''}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
