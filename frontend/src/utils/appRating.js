const STORAGE_KEY = 'hireabble_app_rating';

/**
 * Track session count and optionally prompt for app rating.
 * Returns true if it's time to show a rating prompt.
 *
 * Conditions to show prompt:
 * - At least 5 sessions
 * - At least 1 match (pass matchCount)
 * - User hasn't dismissed or completed the prompt before
 */
export function shouldPromptRating(matchCount = 0) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (data.dismissed) return false;

    const sessions = (data.sessions || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, sessions }));

    return sessions >= 5 && matchCount >= 1;
  } catch {
    return false;
  }
}

/**
 * Mark the rating prompt as dismissed so it won't show again.
 */
export function dismissRatingPrompt() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, dismissed: true }));
  } catch {
    // silent
  }
}

/**
 * Get the appropriate store review URL based on platform.
 */
export function getStoreUrl() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return process.env.REACT_APP_APP_STORE_URL || null;
  }
  if (/Android/i.test(ua)) {
    return process.env.REACT_APP_PLAY_STORE_URL || null;
  }
  return null;
}
