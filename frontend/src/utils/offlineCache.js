/**
 * Offline caching utilities using IndexedDB.
 * Provides job card caching, offline swipe queue, and message caching.
 */

const DB_NAME = 'hireabble-offline';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('jobs')) {
        db.createObjectStore('jobs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('swipeQueue')) {
        db.createObjectStore('swipeQueue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'matchId' });
      }
    };
  });
}

// ==================== JOB CARDS ====================

export async function cacheJobCards(jobs) {
  try {
    const db = await openDB();
    const tx = db.transaction('jobs', 'readwrite');
    const store = tx.objectStore('jobs');
    // Clear old and add new
    store.clear();
    for (const job of jobs) {
      store.put(job);
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB not available — fail silently
  }
}

export async function getCachedJobCards() {
  try {
    const db = await openDB();
    const tx = db.transaction('jobs', 'readonly');
    const store = tx.objectStore('jobs');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

// ==================== SWIPE QUEUE ====================

export async function queueOfflineSwipe(swipeData) {
  try {
    const db = await openDB();
    const tx = db.transaction('swipeQueue', 'readwrite');
    const store = tx.objectStore('swipeQueue');
    const { token, ...safeData } = swipeData; // Strip auth token — never store in IndexedDB
    store.add({ ...safeData, queued_at: new Date().toISOString() });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fail silently
  }
}

export async function getQueuedSwipes() {
  try {
    const db = await openDB();
    const tx = db.transaction('swipeQueue', 'readonly');
    const store = tx.objectStore('swipeQueue');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function clearSwipeQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction('swipeQueue', 'readwrite');
    tx.objectStore('swipeQueue').clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fail silently
  }
}

// ==================== MESSAGES ====================

export async function cacheMessages(matchId, messages) {
  try {
    const db = await openDB();
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    // Store last 50 messages per conversation
    store.put({ matchId, messages: messages.slice(-50), cached_at: new Date().toISOString() });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fail silently
  }
}

export async function getCachedMessages(matchId) {
  try {
    const db = await openDB();
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    return new Promise((resolve, reject) => {
      const request = store.get(matchId);
      request.onsuccess = () => resolve(request.result?.messages || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

// ==================== ONLINE STATUS ====================

export function isOnline() {
  return navigator.onLine;
}
