import { useEffect, useState } from 'react';
import type { ResultsView } from '../components/ResultsViewToggle';

/** Phone map presentation only; search, selection and Leaflet remain with their existing owners. */
export function useMobileMap(view: ResultsView) {
  const [phone, setPhone] = useState(() => matchMedia('(max-width: 767px)').matches);
  const active = phone && view === 'map';
  useEffect(() => {
    const media = matchMedia('(max-width: 767px)');
    const update = () => setPhone(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!active) return;
    const { scrollX, scrollY } = window;
    document.documentElement.classList.add('mobile-map-mode');
    return () => {
      document.documentElement.classList.remove('mobile-map-mode');
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    };
  }, [active]);
  return active;
}
