const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${fallbackSeed}`
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
