import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app_theme') || 'default';
  });
  const [loading, setLoading] = useState(true);

  // Fetch active theme from backend on mount
  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const res = await axios.get(`${API}/theme`);
        const activeTheme = res.data.theme || 'default';
        setTheme(activeTheme);
        localStorage.setItem('app_theme', activeTheme);
      } catch {
        // Fall back to cached or default
      } finally {
        setLoading(false);
      }
    };
    fetchTheme();
  }, []);

  // Apply theme to document whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const updateTheme = useCallback((newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
