/**
 * Haptic feedback service wrapping @capacitor/haptics.
 * Silently no-ops on web so every call site can use it unconditionally.
 * Uses the same lazy-import pattern as capacitor.js (Preferences).
 */
import { isNative } from './capacitor';

let _Haptics = null;
let _ImpactStyle = null;
let _NotificationType = null;

const _ready = isNative
  ? import('@capacitor/haptics').then(m => {
      _Haptics = m.Haptics;
      _ImpactStyle = m.ImpactStyle;
      _NotificationType = m.NotificationType;
    }).catch(() => {})
  : Promise.resolve();

// ---------- Low-level wrappers ----------

async function impact(style = 'Medium') {
  await _ready;
  if (!_Haptics) return;
  try {
    await _Haptics.impact({ style: _ImpactStyle[style] });
  } catch { /* device may not support haptics */ }
}

async function notification(type = 'Success') {
  await _ready;
  if (!_Haptics) return;
  try {
    await _Haptics.notification({ type: _NotificationType[type] });
  } catch {}
}

async function selectionChanged() {
  await _ready;
  if (!_Haptics) return;
  try {
    await _Haptics.selectionChanged();
  } catch {}
}

// ---------- Named presets ----------

/** Right swipe — confirms an affirmative action */
export const swipeRight = () => impact('Medium');

/** Left swipe — lighter, less committed */
export const swipeLeft = () => impact('Light');

/** Up swipe — premium superlike action */
export const swipeUp = () => impact('Heavy');

/** Match — celebratory success feedback */
export const match = () => notification('Success');

/** Subtle confirmation for button taps */
export const buttonTap = () => impact('Light');

/** Something went wrong */
export const error = () => notification('Error');

/** Warning feedback */
export const warning = () => notification('Warning');

/** Toggle, picker, or tab selection change */
export const selection = () => selectionChanged();

const haptic = {
  impact,
  notification,
  selection: selectionChanged,
  swipeRight,
  swipeLeft,
  swipeUp,
  match,
  buttonTap,
  error,
  warning,
};

export default haptic;
