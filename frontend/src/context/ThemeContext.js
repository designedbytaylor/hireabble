import { createContext, useContext, useCallback } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const updateTheme = useCallback(() => {
    // Single theme — no-op
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'professional', updateTheme, loading: false }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
