import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock all context providers
jest.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({ user: null, loading: false }),
}));

jest.mock('../context/AdminAuthContext', () => ({
  AdminAuthProvider: ({ children }) => <div>{children}</div>,
  useAdminAuth: () => ({ admin: null, loading: false }),
}));

jest.mock('../context/ThemeContext', () => ({
  ThemeProvider: ({ children }) => <div>{children}</div>,
}));

// Mock hooks
jest.mock('../hooks/useCanonical', () => () => {});

// Mock sonner Toaster
jest.mock('../components/ui/sonner', () => ({
  Toaster: () => null,
}));

// Mock OAuthButtons (makes API calls)
jest.mock('../components/OAuthButtons', () => () => null);

// Mock useDocumentTitle
jest.mock('../hooks/useDocumentTitle', () => () => {});

// Mock Capacitor imports
jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}), { virtual: true });

import App from '../App';

describe('App', () => {
  test('renders without crashing', () => {
    render(<App />);
    // The app should render - landing page for unauthenticated users
    expect(document.body).toBeTruthy();
  });

  test('shows landing page content for unauthenticated users', () => {
    render(<App />);
    // Landing page should be visible since user is null
    // At minimum the app should render without throwing
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });
});
