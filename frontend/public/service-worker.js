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
  // Only cache non-user-specific API responses.  Per-user endpoints like
  // /api/dashboard, /api/stats, /api/notifications, etc. are NOT cached
  // because the service worker matches by URL only (ignores Auth header).
  // Stale-while-revalidate on per-user data causes visible bugs: stats show
  // old counts ("0 Applied" when it should be 8), dashboard flickers between
  // stale and fresh values, and switching users returns the wrong data.
  return url.includes('/api/oauth/config');
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

  // Never cache API requests in the static asset cache — they contain
  // user-specific data keyed by Auth header that the SW ignores.
  if (url.includes('/api/')) {
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

// Background Sync: flush offline swipe queue when connectivity returns
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-swipes') {
    event.waitUntil(
      (async () => {
        try {
          const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('hireabble-offline', 1);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          const tx = db.transaction('swipeQueue', 'readonly');
          const store = tx.objectStore('swipeQueue');
          const swipes = await new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          });

          // Request auth token from active client window (avoid storing tokens in IndexedDB)
          let authToken = null;
          const clients = await self.clients.matchAll({ type: 'window' });
          if (clients.length > 0) {
            authToken = await new Promise((resolve) => {
              const channel = new MessageChannel();
              channel.port1.onmessage = (e) => resolve(e.data?.token || null);
              clients[0].postMessage({ type: 'GET_AUTH_TOKEN' }, [channel.port2]);
              setTimeout(() => resolve(null), 3000);
            });
          }

          if (!authToken) {
            // No active window or token unavailable — skip sync, will retry when app opens
            return;
          }

          for (const swipe of swipes) {
            try {
              await fetch('/api/swipe', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ job_id: swipe.job_id, action: swipe.action }),
              });
            } catch {
              // Will retry on next sync
            }
          }

          // Clear the queue after processing
          const clearTx = db.transaction('swipeQueue', 'readwrite');
          clearTx.objectStore('swipeQueue').clear();
        } catch {
          // IndexedDB not available
        }
      })()
    );
  }
});
