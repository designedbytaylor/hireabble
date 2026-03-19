import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function useCanonical() {
  const { pathname } = useLocation();

  useEffect(() => {
    const url = `https://hireabble.com${pathname}`;
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);

    return () => {
      // Don't remove — let next page update it
    };
  }, [pathname]);
}
