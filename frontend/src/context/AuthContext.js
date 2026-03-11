import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Global timeout — generous enough for mobile 3G/slow networks
axios.defaults.timeout = 20000;

// Don't hydrate stale cached user on impersonation route — it will be replaced immediately
const isImpersonateRoute = window.location.pathname === '/impersonate';

export const AuthProvider = ({ children }) => {
  // Hydrate cached user immediately so pages render without waiting for network
  const [user, setUser] = useState(() => {
    if (isImpersonateRoute) return null;
    try {
      const cached = localStorage.getItem('cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState(() => isImpersonateRoute ? null : localStorage.getItem('token'));
  const [loading, setLoading] = useState(() => {
    if (isImpersonateRoute) return false;
    // If we have cached user data, skip loading state entirely
    const hasCached = !!localStorage.getItem('cached_user');
    return !hasCached && !!localStorage.getItem('token');
  });

  // Ref to the current auth-init AbortController so loginWithToken can cancel it
  const authInitController = useRef(null);
  // When loginWithToken sets the token, skip the useEffect auth init —
  // loginWithToken already fetches /auth/me directly and handles everything.
  const skipNextAuthInit = useRef(false);

  useEffect(() => {
    if (skipNextAuthInit.current) {
      skipNextAuthInit.current = false;
      return;
    }
    const controller = new AbortController();
    authInitController.current = controller;
    const initAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000,
            signal: controller.signal
          });
          if (!controller.signal.aborted) {
            setUser(response.data);
            localStorage.setItem('cached_user', JSON.stringify(response.data));
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          console.error('Auth initialization failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('cached_user');
          setToken(null);
        }
      }
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    };
    initAuth();
    return () => controller.abort();
  }, [token]);

  // Global axios interceptor: auto-logout on invalid/expired token or banned users
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const detail = error.response?.data?.detail;
        // Any 401 means the token is dead — clear session and redirect
        if (status === 401 && detail && !error.config?.url?.includes('/auth/login')) {
          localStorage.removeItem('token');
          localStorage.removeItem('cached_user');
          setToken(null);
          setUser(null);
          window.location.href = '/login';
        }
        if (status === 403 && detail?.includes('banned')) {
          localStorage.removeItem('token');
          localStorage.removeItem('cached_user');
          setToken(null);
          setUser(null);
          window.location.href = '/login?reason=banned';
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('cached_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (userData) => {
    const response = await axios.post(`${API}/auth/register`, userData);
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('cached_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const loginWithToken = useCallback(async (impersonateToken) => {
    // Abort any in-flight auth initialization to prevent it from overwriting
    // the impersonated user with a stale cached identity (race condition)
    if (authInitController.current) {
      authInitController.current.abort();
    }

    // Clear stale cached user to prevent flash of wrong identity
    setUser(null);

    // Clear ALL user data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('cached_user');
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('hireabble_')) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Purge ALL service-worker caches — the static asset cache (hireabble-v4)
    // can also hold stale API responses if same-origin, not just hireabble-api-v7.
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    } catch (_) { /* ok */ }

    // Skip the useEffect auth init that setToken will trigger —
    // we handle the /auth/me fetch directly below.
    skipNextAuthInit.current = true;
    localStorage.setItem('token', impersonateToken);
    setToken(impersonateToken);
    try {
      const response = await axios.get(`${API}/auth/me?_=${Date.now()}`, {
        headers: { Authorization: `Bearer ${impersonateToken}` }
      });
      setUser(response.data);
      localStorage.setItem('cached_user', JSON.stringify(response.data));
      return response.data;
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('cached_user');
      setToken(null);
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('cached_user');
    setToken(null);
    setUser(null);
    // Purge all SW caches so next login doesn't see stale user data
    try { caches.keys().then(names => names.forEach(n => caches.delete(n))); } catch (_) { /* ok */ }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const response = await axios.put(`${API}/auth/profile`, updates, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUser(response.data);
    localStorage.setItem('cached_user', JSON.stringify(response.data));
    return response.data;
  }, [token]);

  const value = useMemo(() => ({
    user, token, loading, login, loginWithToken, register, logout, updateProfile
  }), [user, token, loading, login, loginWithToken, register, logout, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
