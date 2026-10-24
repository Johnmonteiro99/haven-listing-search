import { useEffect, useRef, useState } from 'react';
import { DomEvent } from 'leaflet';
import { useMap } from 'react-leaflet';
import { fitResults } from './MapViewport';
import type { MapLocation } from './mapListings';

/** Native buttons operate Leaflet and stay out of its drag/double-click handlers. */
export function MapControls({ locations }: { locations: MapLocation[] }) {
  const map = useMap();
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!toolbar.current) return;
    // Leaflet uses native listeners; React bubbling alone runs too late to stop a drag start.
    DomEvent.disableClickPropagation(toolbar.current);
    DomEvent.disableScrollPropagation(toolbar.current);
  }, []);
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    map.on('zoomend', update);
    return () => { map.off('zoomend', update); };
  }, [map]);
  return <div ref={toolbar} className="map-toolbar" role="group" aria-label="Map controls"
    onKeyDown={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}
    onDoubleClick={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <button type="button" aria-label="Zoom in" disabled={zoom >= map.getMaxZoom()} onClick={() => map.zoomIn()}>+</button>
    <button type="button" aria-label="Zoom out" disabled={zoom <= map.getMinZoom()} onClick={() => map.zoomOut()}>−</button>
    <button type="button" aria-label="Fit visible listings" disabled={!locations.length} onClick={() => fitResults(map, locations)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
    </button>
  </div>;
}
