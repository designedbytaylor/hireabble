import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { isNative } from '../utils/capacitor';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Open a URL — uses Capacitor Browser (SFSafariViewController / Chrome Custom Tabs)
 * on native platforms so the WebView is preserved, falls back to window.location.href on web.
 */
async function openAuthUrl(url) {
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch {
      // fallback to window.location if plugin unavailable
    }
  }
  window.location.href = url;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const AppleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0A66C2">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

export default function OAuthButtons({ role = 'seeker' }) {
  const navigate = useNavigate();
  const [oauthConfig, setOauthConfig] = useState(null);
  const [loading, setLoading] = useState({ google: false, github: false, apple: false, linkedin: false, facebook: false });

  const generateState = useCallback((role, extra = {}) => {
    const nonce = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const state = JSON.stringify({ role, nonce, ...extra });
    sessionStorage.setItem('oauth_state_nonce', nonce);
    return state;
  }, []);

  useEffect(() => {
    axios.get(`${API}/auth/oauth/config`).then(res => {
      setOauthConfig(res.data);
    }).catch(() => {
      // OAuth not available, hide buttons
    });
  }, []);

  const handleGoogleLogin = useCallback(() => {
    if (!oauthConfig?.google?.enabled) return;

    const redirectUri = `${window.location.origin}/login`;
    const params = new URLSearchParams({
      client_id: oauthConfig.google.client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: generateState(role),
    });

    openAuthUrl(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }, [oauthConfig, role, generateState]);

  const handleGithubLogin = useCallback(() => {
    if (!oauthConfig?.github?.enabled) return;

    const params = new URLSearchParams({
      client_id: oauthConfig.github.client_id,
      scope: 'user:email',
      state: generateState(role),
    });

    openAuthUrl(`https://github.com/login/oauth/authorize?${params}`);
  }, [oauthConfig, role, generateState]);

  const handleAppleLogin = useCallback(() => {
    if (!oauthConfig?.apple?.enabled) return;

    const redirectUri = `${window.location.origin}/login`;
    const params = new URLSearchParams({
      client_id: oauthConfig.apple.client_id,
      redirect_uri: redirectUri,
      response_type: 'code id_token',
      scope: 'name email',
      response_mode: 'fragment',
      state: generateState(role, { provider: 'apple' }),
    });

    openAuthUrl(`https://appleid.apple.com/auth/authorize?${params}`);
  }, [oauthConfig, role, generateState]);

  const handleLinkedInLogin = useCallback(() => {
    if (!oauthConfig?.linkedin?.enabled) return;

    const redirectUri = `${window.location.origin}/login`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: oauthConfig.linkedin.client_id,
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state: generateState(role, { provider: 'linkedin' }),
    });

    openAuthUrl(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
  }, [oauthConfig, role, generateState]);

  const handleFacebookLogin = useCallback(() => {
    if (!oauthConfig?.facebook?.enabled) return;

    const redirectUri = `${window.location.origin}/login`;
    const params = new URLSearchParams({
      client_id: oauthConfig.facebook.client_id,
      redirect_uri: redirectUri,
      scope: 'email,public_profile',
      response_type: 'code',
      state: generateState(role, { provider: 'facebook' }),
    });

    openAuthUrl(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
  }, [oauthConfig, role, generateState]);

  // Handle OAuth callback
  useEffect(() => {
    // Check URL search params (Google/GitHub/LinkedIn/Facebook) and hash fragment (Apple)
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));

    const code = urlParams.get('code') || hashParams.get('code');
    const state = urlParams.get('state') || hashParams.get('state');
    const idToken = hashParams.get('id_token');

    if (!code && !idToken) return;

    let parsedRole = role;
    let parsedProvider = null;
    try {
      const parsed = JSON.parse(state || '{}');
      // Validate CSRF nonce
      const storedNonce = sessionStorage.getItem('oauth_state_nonce');
      if (!storedNonce || parsed.nonce !== storedNonce) {
        toast.error('Invalid OAuth state. Please try again.');
        return;
      }
      sessionStorage.removeItem('oauth_state_nonce');
      parsedRole = parsed.role || role;
      parsedProvider = parsed.provider || null;
    } catch {}

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);

    // Determine provider
    let provider;
    if (parsedProvider === 'apple' || idToken) {
      provider = 'apple';
    } else if (parsedProvider === 'linkedin') {
      provider = 'linkedin';
    } else if (parsedProvider === 'facebook') {
      provider = 'facebook';
    } else if (!urlParams.get('scope')) {
      provider = 'github'; // Google has scope in callback, GitHub doesn't
    } else {
      provider = 'google';
    }

    const exchangeCode = async () => {
      setLoading(prev => ({ ...prev, [provider]: true }));

      try {
        const payload = { code, role: parsedRole };
        if (provider === 'google' || provider === 'linkedin' || provider === 'facebook') {
          payload.redirect_uri = `${window.location.origin}/login`;
        }
        if (provider === 'apple') {
          payload.id_token = idToken;
        }

        const response = await axios.post(`${API}/auth/oauth/${provider}`, payload);
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        toast.success(`Welcome${user.name ? ', ' + user.name : ''}!`);

        // Force page reload to pick up new auth state
        if (!user.onboarding_complete) {
          window.location.href = user.role === 'seeker' ? '/onboarding' : '/recruiter/onboarding';
        } else {
          window.location.href = user.role === 'seeker' ? '/dashboard' : '/recruiter';
        }
      } catch (error) {
        toast.error(error.response?.data?.detail || `${provider} sign-in failed`);
      } finally {
        setLoading(prev => ({ ...prev, [provider]: false }));
      }
    };

    exchangeCode();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render if no OAuth providers are configured
  const hasAnyProvider = oauthConfig && (
    oauthConfig.google?.enabled || oauthConfig.github?.enabled || oauthConfig.apple?.enabled ||
    oauthConfig.linkedin?.enabled || oauthConfig.facebook?.enabled
  );
  if (!hasAnyProvider) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="relative flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground uppercase">or continue with</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {oauthConfig.apple?.enabled && (
        <button
          type="button"
          onClick={handleAppleLogin}
          disabled={loading.apple}
          className="w-full h-12 rounded-xl bg-white text-black hover:bg-gray-100 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 font-medium"
        >
          {loading.apple ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <AppleIcon />
              <span className="text-sm font-medium">Sign in with Apple</span>
            </>
          )}
        </button>
      )}

      <div className="flex gap-3">
        {oauthConfig.google?.enabled && (
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading.google}
            className="flex-1 h-12 rounded-xl border border-border bg-background hover:bg-accent flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading.google ? (
              <div className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <GoogleIcon />
                <span className="text-sm font-medium">Google</span>
              </>
            )}
          </button>
        )}

        {oauthConfig.github?.enabled && (
          <button
            type="button"
            onClick={handleGithubLogin}
            disabled={loading.github}
            className="flex-1 h-12 rounded-xl border border-border bg-background hover:bg-accent flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading.github ? (
              <div className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <GitHubIcon />
                <span className="text-sm font-medium">GitHub</span>
              </>
            )}
          </button>
        )}
      </div>

      {(oauthConfig.linkedin?.enabled || oauthConfig.facebook?.enabled) && (
        <div className="flex gap-3">
          {oauthConfig.linkedin?.enabled && (
            <button
              type="button"
              onClick={handleLinkedInLogin}
              disabled={loading.linkedin}
              className="flex-1 h-12 rounded-xl border border-border bg-background hover:bg-accent flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading.linkedin ? (
                <div className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LinkedInIcon />
                  <span className="text-sm font-medium">LinkedIn</span>
                </>
              )}
            </button>
          )}

          {oauthConfig.facebook?.enabled && (
            <button
              type="button"
              onClick={handleFacebookLogin}
              disabled={loading.facebook}
              className="flex-1 h-12 rounded-xl border border-border bg-background hover:bg-accent flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading.facebook ? (
                <div className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FacebookIcon />
                  <span className="text-sm font-medium">Facebook</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
