// Lightweight first-party page-view tracker.
// Posts to the backend analytics ingest endpoint on route changes.

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const VISITOR_KEY = 'hb_visitor_id';
const SESSION_KEY = 'hb_session_id';

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function trackPageView(path) {
  try {
    if (!path) return;
    // Skip admin panel and impersonation entry
    if (path.startsWith('/admin') || path.startsWith('/impersonate')) return;
    // Skip when currently impersonating a user (admin_token + user token present)
    if (localStorage.getItem('admin_token') && localStorage.getItem('token')) return;

    const body = JSON.stringify({
      path,
      referrer: document.referrer || '',
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      screen_w: window.screen?.width || null,
      screen_h: window.screen?.height || null,
    });

    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${API}/analytics/track`, {
      method: 'POST',
      headers,
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // swallow — analytics must never break the app
  }
}
