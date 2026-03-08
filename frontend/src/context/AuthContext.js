import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Global timeout so no request hangs indefinitely on slow mobile networks
axios.defaults.timeout = 10000;

export const AuthProvider = ({ children }) => {
  // Hydrate cached user immediately so pages render without waiting for network
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(() => {
    // If we have cached user data, skip loading state entirely
    const hasCached = !!localStorage.getItem('cached_user');
    return !hasCached && !!localStorage.getItem('token');
  });

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000
          });
          setUser(response.data);
          localStorage.setItem('cached_user', JSON.stringify(response.data));
        } catch (error) {
          console.error('Auth initialization failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('cached_user');
          setToken(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  // Global axios interceptor: auto-logout banned/suspended users
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403 &&
            error.response?.data?.detail?.includes('banned')) {
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

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('cached_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API}/auth/register`, userData);
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('cached_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const loginWithToken = async (impersonateToken) => {
    localStorage.setItem('token', impersonateToken);
    setToken(impersonateToken);
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${impersonateToken}` }
      });
      setUser(response.data);
      return response.data;
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      return null;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('cached_user');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (updates) => {
    const response = await axios.put(`${API}/auth/profile`, updates, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUser(response.data);
    localStorage.setItem('cached_user', JSON.stringify(response.data));
    return response.data;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithToken, register, logout, updateProfile }}>
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
