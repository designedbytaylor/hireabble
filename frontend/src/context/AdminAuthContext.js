import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AdminAuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/admin/me`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000
          });
          setAdmin(response.data);
        } catch (error) {
          localStorage.removeItem('admin_token');
          setToken(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/admin/login`, { email, password });
    if (response.data.requires_2fa) {
      return { requires_2fa: true, temp_token: response.data.temp_token };
    }
    const { token: newToken, admin: adminData } = response.data;
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
    setAdmin(adminData);
    return adminData;
  };

  const verify2FA = async (tempToken, code) => {
    const response = await axios.post(`${API}/admin/2fa/verify`, {
      temp_token: tempToken,
      code,
    });
    const { token: newToken, admin: adminData } = response.data;
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
    setAdmin(adminData);
    return adminData;
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, token, loading, login, logout, verify2FA }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
