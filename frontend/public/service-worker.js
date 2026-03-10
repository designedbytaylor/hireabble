const CACHE_NAME = 'hireabble-v4';
const IMG_CACHE = 'hireabble-images-v1';
const API_CACHE = 'hireabble-api-v7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  const KEEP = [CACHE_NAME, IMG_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Hireabble', body: 'You have a new notification' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.message || '',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: data.tag || 'hireabble-notification',
    data: data.data || {},
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Route based on notification type
  if (data.match_id) {
    url = `/chat/${data.match_id}`;
  } else if (data.interview_id) {
    url = '/interviews';
  } else if (data.type === 'match') {
    url = '/matches';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window or open new one
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Allow the app to purge user-specific caches (e.g. on impersonation / logout)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_API_CACHE') {
    caches.delete(API_CACHE);
  }
});

// Helper: is this an image request?
function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico)(\?.*)?$/i.test(url) ||
    url.includes('/uploads/');
}

// Helper: is this a cacheable GET API request?
function isCacheableApi(url) {
  // Stale-while-revalidate: show cached data instantly, update in background.
  // These endpoints are per-user (auth header varies the response) but benefit
  // from showing stale data for a few seconds while the fresh response loads.
  //
  // NOTE: /api/auth/me is intentionally EXCLUDED — the cache matches by URL only
  // (ignoring the Authorization header), so switching users (e.g. admin impersonation)
  // would return the previously-cached user's data, logging you in as the wrong person.
  return url.includes('/api/dashboard') ||
    url.includes('/api/recruiter/dashboard-data') ||
    url.includes('/api/stats') ||
    url.includes('/api/profile/completeness') ||
    url.includes('/api/superlikes/remaining') ||
    url.includes('/api/notifications') ||
    url.includes('/api/oauth/config');
}

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET and WebSocket requests
  if (request.method !== 'GET' || url.includes('/ws/')) {
    return;
  }

  // Images: cache-first (images don't change)
  if (isImageRequest(url)) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached || new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  // Cacheable API: stale-while-revalidate (show cached data instantly, update in background)
  if (isCacheableApi(url)) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
          // Return cached immediately if available, otherwise wait for network
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Static assets: cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached || null);

      return cached || fetched;
    }).then((response) => {
      // Ensure respondWith never receives null/undefined
      if (response) return response;
      // For navigation requests, redirect to index.html (SPA fallback)
      if (request.mode === 'navigate') {
        return caches.match('/index.html') || fetch('/index.html');
      }
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});
