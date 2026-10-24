import { useEffect } from 'react';
import { latLngBounds, type Map as LeafletMap } from 'leaflet';
import { useMap } from 'react-leaflet';
import type { MapLocation } from './mapListings';

/** Fit the current page into the map column; never move it merely for a selection/theme change. */
export function fitResults(map: LeafletMap, locations: MapLocation[]) {
  if (!locations.length) return;
  const canvas = map.getContainer();
  const phone = canvas.closest('.mobile-map-active');
  // Reserve the largest phone card even while collapsed, so selection never moves the camera.
  const header = phone?.querySelector('.mobile-map-header')?.getBoundingClientRect();
  const height = canvas.getBoundingClientRect().height;
  map.fitBounds(latLngBounds(locations.map(location => location.position)), {
    paddingTopLeft: phone ? [32, (header?.bottom ?? 136) + 16] : [48, 48],
    paddingBottomRight: phone ? [76, Math.min(300, Math.max(140, height - 360)) + 108] : [80, 64],
    maxZoom: 14, animate: false,
  });
}

/** Observe the actual container when the canvas size changes; coalesce work per frame. */
export function MapViewport({ locations }: { locations: MapLocation[] }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Interactive property map');
    container.setAttribute('aria-describedby', 'map-keyboard-help');
    let frame = 0;
    const layout = () => matchMedia('(max-width: 767px)').matches ? 'phone' : matchMedia('(min-width: 1200px)').matches ? 'desktop' : 'tablet';
    let currentLayout = layout();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, debounceMoveend: true });
        const nextLayout = layout();
        // Crossing the sticky-column breakpoint changes the usable geographic area.
        if (currentLayout !== nextLayout) { currentLayout = nextLayout; fitResults(map, locations); }
      });
    });
    observer.observe(map.getContainer());
    // Fit once immediately and once after the 400ms reveal settles, never on theme changes.
    fitResults(map, locations);
    const timer = window.setTimeout(() => { map.invalidateSize({ pan: false }); fitResults(map, locations); },
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [map, locations]);
  return null;
}
