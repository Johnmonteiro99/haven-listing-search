import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { divIcon, type Marker as LeafletMarker } from 'leaflet';
import { MapContainer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Listing } from '../api/listings';
import { currency } from '../components/listingPresentation';
import type { ResolvedTheme } from '../theme/useTheme';
import { MapTiles } from './MapTiles';
import { MapViewport } from './MapViewport';
import { MapControls } from './MapControls';
import { groupMapLocations, listingKey, type MapLocation } from './mapListings';

interface ListingMapProps {
  mobile?: boolean;
  listings: Listing[];
  theme?: ResolvedTheme;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

function LocationMarker({ location, selectedKey, onSelect, mobile }: { location: MapLocation; selectedKey: string | null; onSelect: (key: string) => void; mobile: boolean }) {
  const marker = useRef<LeafletMarker>(null);
  const focusFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(focusFrame.current), []);
  const map = useMap();
  const [chooserOpen, setChooserOpen] = useState(false);
  const choices = useRef<HTMLDivElement>(null);
  const phoneWorkspace = mobile ? map.getContainer().closest('.mobile-map-active') : null;
  useEffect(() => {
    if (mobile && chooserOpen) choices.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [mobile, chooserOpen]);
  const selected = location.listings.some(listing => listingKey(listing) === selectedKey);
  const first = location.listings[0];
  const multiple = location.listings.length > 1;
  const label = multiple ? `${location.listings.length} listings at ${first.address}, ${first.city}. From ${currency.format(Math.min(...location.listings.map(item => item.price)))}. Choose an MLS record.` :
    `${currency.format(first.price)}, ${first.address}, ${first.city}, ${first.state}. ${first.source}, ${first.id}.`;
  const price = currency.format(first.price);
  const compactPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(first.price);
  const icon = useMemo(() => divIcon({
    className: `haven-map-marker${selected ? ' is-selected' : ''}`,
    // Only formatted API numbers and fixed symbols enter HTML, never feed text.
    html: `<span aria-hidden="true">${selected ? '✓ ' : ''}${multiple ? location.listings.length : compactPrice}</span>`,
    iconSize: [multiple ? 48 : 76, 44], iconAnchor: [multiple ? 24 : 38, 22], popupAnchor: [0, -24],
  }), [selected, multiple, location.listings.length, compactPrice]);

  useEffect(() => {
    const element = marker.current?.getElement();
    if (!element) return;
    element.setAttribute('aria-label', `${selected ? 'Selected. ' : ''}${label}`);
    element.setAttribute('aria-pressed', String(selected));
    // Leaflet supplies Enter activation; add Space without letting it pan the map.
    function space(event: KeyboardEvent) {
      if (event.key === ' ') { event.preventDefault(); event.stopPropagation(); element?.click(); }
    }
    element.addEventListener('keydown', space);
    return () => element.removeEventListener('keydown', space);
  }, [label, selected]);

  function choose(listing: Listing) { map.closePopup(); onSelect(listingKey(listing)); }
  const chooser = <div ref={choices} className={`map-location-choices${mobile ? ' mobile-map-location-choices' : ''}`} role="group" aria-label="Choose a listing at this location"
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); map.closePopup(); }
    }}><p>Records at this location</p>
    {location.listings.map(listing => <button type="button" key={listingKey(listing)}
      aria-pressed={listingKey(listing) === selectedKey} onClick={() => choose(listing)}>
      {currency.format(listing.price)} · {listing.address}<small>{listing.source} / {listing.id}</small>
    </button>)}
    {mobile && <button type="button" onClick={() => map.closePopup()}>Close record choices</button>}
  </div>;
  return <Marker ref={marker} position={location.position} icon={icon} title={label} alt={label}
    keyboard riseOnHover eventHandlers={{ click: () => { if (!multiple) choose(first); },
      popupclose: () => {
        setChooserOpen(false);
        cancelAnimationFrame(focusFrame.current);
        marker.current?.getElement()?.focus({ preventScroll: true });
      },
      popupopen: () => {
        setChooserOpen(true);
        cancelAnimationFrame(focusFrame.current);
        focusFrame.current = requestAnimationFrame(() => marker.current?.getPopup()?.getElement()?.querySelector<HTMLButtonElement>('button')?.focus());
      },
    }}>
    <Tooltip direction="top" offset={[0, -24]}>{multiple ? `${location.listings.length} MLS records · from ${currency.format(Math.min(...location.listings.map(item => item.price)))}` : price}</Tooltip>
    {multiple && <Popup autoPan={false} closeButton={false}>
      {mobile ? null : chooser}
    </Popup>}
    {/* Keep the phone chooser above floating controls without panning the geographic canvas. */}
    {multiple && chooserOpen && phoneWorkspace && createPortal(chooser, phoneWorkspace)}
  </Marker>;
}

/** Theme changes replace only the tile layer, preserving the camera and selected identity. */
export default function ListingMap({ listings, selectedKey, onSelect, theme = 'light', mobile = false }: ListingMapProps) {
  const locations = useMemo(() => groupMapLocations(listings), [listings]);
  const [tileStatus, setTileStatus] = useState('Loading map tiles…');
  const omitted = listings.length - locations.reduce((count, location) => count + location.listings.length, 0);
  return <div className="listing-map-shell">
    <MapContainer center={locations[0]?.position ?? [0, 0]} zoom={locations.length ? 10 : 2} minZoom={2} maxZoom={19}
      className="listing-map" zoomControl={false} scrollWheelZoom={false} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false}>
      <MapTiles theme={theme} onStatus={setTileStatus} />
      <MapControls locations={locations} />
      <MapViewport locations={locations} />
      {locations.map(location => <LocationMarker key={JSON.stringify(location.position)} location={location} mobile={mobile} selectedKey={selectedKey} onSelect={onSelect} />)}
    </MapContainer>
    <div className="map-tile-status" data-problem={omitted > 0 || /unavailable|could not/.test(tileStatus)} role="status"><span>{tileStatus}</span><span> {locations.length} mapped locations.</span>
      {omitted > 0 && ` ${omitted} ${omitted === 1 ? 'listing has' : 'listings have'} unavailable map coordinates; use the cards.`}
    </div>
    <p className="map-help" id="map-keyboard-help">Tab to markers; Enter or Space selects. Arrow keys pan the focused map. Use the controls to zoom.</p>
  </div>;
}
