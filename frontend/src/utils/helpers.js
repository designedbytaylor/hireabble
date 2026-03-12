const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Build a DiceBear avatar URL for a given seed.
 */
export function getAvatarFallback(seed) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed || 'default'}&backgroundColor=0ea5e9,6366f1,8b5cf6,ec4899,f43f5e&fontFamily=Arial`;
}

/**
 * Normalize a photo URL to ensure it's a full URL
 * Handles cases where the URL is:
 * - A full URL (https://...)
 * - A relative path (/api/photos/...)
 * - null/undefined
 */
export function getPhotoUrl(photoUrl, fallbackSeed) {
  if (!photoUrl) {
    return fallbackSeed
      ? getAvatarFallback(fallbackSeed)
      : null;
  }

  // If it's already a full URL, return as-is
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    return photoUrl;
  }

  // If it's a relative path, prepend backend URL
  if (photoUrl.startsWith('/')) {
    return `${BACKEND_URL}${photoUrl}`;
  }

  // Otherwise return as-is
  return photoUrl;
}

/**
 * onError handler for <img> tags using profile photos.
 * Falls back to a DiceBear avatar on load failure.
 * Usage: <img onError={handleImgError(userId)} ... />
 */
export function handleImgError(fallbackSeed) {
  return (e) => {
    e.target.onerror = null; // prevent infinite loop
    e.target.src = getAvatarFallback(fallbackSeed);
  };
}
