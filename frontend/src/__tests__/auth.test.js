import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock AuthContext
const mockLogin = jest.fn();
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: mockLogin,
  }),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

// Mock useDocumentTitle
jest.mock('../hooks/useDocumentTitle', () => () => {});

// Mock OAuthButtons (it makes API calls on mount)
jest.mock('../components/OAuthButtons', () => () => null);

import Login from '../pages/Login';

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
};

describe('Login Page', () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  test('renders login form with email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  test('renders email input with correct placeholder', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  test('renders Sign In heading', () => {
    renderLogin();
    expect(screen.getByText('Sign In', { selector: 'h2' })).toBeInTheDocument();
  });

  test('renders Sign In submit button', () => {
    renderLogin();
    const submitBtn = screen.getByTestId('login-submit-btn');
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toHaveTextContent('Sign In');
  });

  test('renders forgot password link', () => {
    renderLogin();
    const link = screen.getByTestId('forgot-password-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('Forgot password?');
  });

  test('renders create account link', () => {
    renderLogin();
    const link = screen.getByTestId('register-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('Create one');
  });

  test('allows typing in email and password fields', () => {
    renderLogin();
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  test('shows validation toast when submitting empty form', async () => {
    const { toast } = require('sonner');
    renderLogin();

    const submitBtn = screen.getByTestId('login-submit-btn');
    fireEvent.click(submitBtn);

    expect(toast.error).toHaveBeenCalledWith('Please fill in all fields');
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValue({ role: 'seeker' });
    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitBtn = screen.getByTestId('login-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  test('password field toggles visibility', () => {
    renderLogin();
    const passwordInput = screen.getByLabelText(/password/i);

    // Initially password type
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click the toggle button (the eye icon button next to password)
    const toggleBtn = passwordInput.parentElement.querySelector('button');
    fireEvent.click(toggleBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
