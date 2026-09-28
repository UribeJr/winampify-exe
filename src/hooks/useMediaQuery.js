import { useState, useEffect } from 'react';

// Keep in sync with the @media blocks in styles/mobile.css and styles/base.css
export const MOBILE_QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)';

const matches = (query) => typeof window !== 'undefined' && window.matchMedia(query).matches;

export function useMediaQuery(query) {
  const [value, setValue] = useState(() => matches(query));

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setValue(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return value;
}

// Phone-sized layout. One shared breakpoint instead of per-component innerWidth checks.
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);

// Windows open maximized (no dragging) on phones and very short screens
export const useForceMaximized = () => useMediaQuery(`${MOBILE_QUERY}, (max-height: 500px)`);

// Browsers where the Web Playback SDK can't output audio (phones and tablets, incl. iPadOS),
// so playback runs as a Spotify Connect remote instead.
export const isMobileDevice = () => {
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPadOS;
};
