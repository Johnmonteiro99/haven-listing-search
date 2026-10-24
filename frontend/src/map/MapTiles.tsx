import { useEffect, useRef, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import type { ResolvedTheme } from '../theme/useTheme';

const osm = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

/** Stadia allows keyless localhost development. Other hosts keep the established OSM provider. */
export function mapTileSource(theme: ResolvedTheme, hostname: string) {
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return osm;
  return {
    url: `https://tiles.stadiamaps.com/tiles/alidade_smooth${theme === 'dark' ? '_dark' : ''}/{z}/{x}/{y}.png`,
    attribution: '&copy; <a href="https://stadiamaps.com/attribution/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
}

/** A failed themed layer falls back once; markers and the Leaflet camera stay mounted. */
export function MapTiles({ theme, onStatus }: { theme: ResolvedTheme; onStatus: (status: string) => void }) {
  const [fallback, setFallback] = useState(false);
  const active = useRef<{ load: () => boolean; fail: () => void } | null>(null);
  const source = fallback ? osm : mapTileSource(theme, window.location.hostname);
  useEffect(() => {
    let loaded = false;
    let failed = false;
    onStatus(fallback ? 'Themed tiles unavailable. Using the standard map.' : 'Loading map tiles…');
    const timer = window.setTimeout(() => {
      if (!loaded) fail();
    }, 10000);
    function fail() {
      failed = true;
      if (source.url !== osm.url) setFallback(true);
      else onStatus('Some map tiles could not load. Listing markers and cards remain available.');
    }
    // Tile events are installed below; the timer is cancelled after the first successful tile.
    const stop = () => { loaded = true; clearTimeout(timer); return !failed; };
    active.current = { load: stop, fail };
    return () => clearTimeout(timer);
  }, [source.url, fallback, onStatus]);
  return <TileLayer key={source.url} url={source.url} attribution={source.attribution} maxZoom={19}
    keepBuffer={0} updateWhenIdle updateWhenZooming={false} eventHandlers={{
      tileload: () => { if (active.current?.load()) onStatus(fallback ? 'Standard map fallback. Listing markers remain available.' : 'Map ready. Shared markers let you choose each MLS record.'); },
      tileerror: () => active.current?.fail(),
    }} />;
}
