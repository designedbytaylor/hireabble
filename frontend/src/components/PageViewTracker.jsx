import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

export default function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname, location.search]);

  return null;
}
