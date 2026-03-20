/**
 * Capacitor native platform utilities.
 * Detects if the app is running inside a native iOS/Android shell
 * and provides helpers for platform-specific behavior.
 */
import { Capacitor } from '@capacitor/core';

/** True when running inside the native iOS or Android app */
export const isNative = Capacitor.isNativePlatform();

/** 'ios' | 'android' | 'web' */
export const platform = Capacitor.getPlatform();

/** True specifically on iOS native */
export const isIOS = platform === 'ios';

/** True specifically on Android native */
export const isAndroid = platform === 'android';

/**
 * Returns the correct payment method for the current platform.
 * Apple requires IAP for digital goods on iOS.
 */
export function getPaymentMethod() {
  if (isIOS) return 'apple_iap';
  if (isAndroid) return 'google_play';
  return 'stripe';
}

/**
 * Open an external URL. Uses Capacitor Browser (SFSafariViewController /
 * Chrome Custom Tabs) on native, falls back to window.open on web.
 */
export async function openExternal(url) {
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    } catch {
      // plugin unavailable, fall through
    }
  }
  window.open(url, '_blank');
}

/**
 * Secure token storage abstraction.
 * Uses Capacitor Preferences (encrypted on native) when available,
 * falls back to localStorage on web.
 */
let _Preferences = null;
const _preferencesReady = isNative
  ? import('@capacitor/preferences').then(m => { _Preferences = m.Preferences; }).catch(() => {})
  : Promise.resolve();

export const secureStorage = {
  async get(key) {
    if (isNative) {
      await _preferencesReady;
      if (_Preferences) {
        const { value } = await _Preferences.get({ key });
        return value;
      }
    }
    return localStorage.getItem(key);
  },

  async set(key, value) {
    if (isNative) {
      await _preferencesReady;
      if (_Preferences) {
        await _Preferences.set({ key, value });
        return;
      }
    }
    localStorage.setItem(key, value);
  },

  async remove(key) {
    if (isNative) {
      await _preferencesReady;
      if (_Preferences) {
        await _Preferences.remove({ key });
        return;
      }
    }
    localStorage.removeItem(key);
  },

  async clear() {
    if (isNative) {
      await _preferencesReady;
      if (_Preferences) {
        await _Preferences.clear();
        return;
      }
    }
    // Only clear hireabble-specific keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === 'token' || k === 'cached_user' || k.startsWith('hireabble_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
};
