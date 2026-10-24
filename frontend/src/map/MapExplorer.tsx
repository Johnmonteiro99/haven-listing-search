import { lazy, Suspense, useEffect, useRef } from 'react';
import type { Listing, SearchResponse } from '../api/listings';
import { ListingCard } from '../components/ListingCard';
import { MobileMapDeck } from './MobileMapDeck';
import { MapBoundary } from './MapBoundary';
import type { ResolvedTheme } from '../theme/useTheme';
import { listingKey } from './mapListings';

// The Leaflet code, CSS, and tile requests do not start in the initial Grid view.
const ListingMap = lazy(() => import('./ListingMap'));

interface MapExplorerProps {
  mobile?: boolean;
  onPage: (page: number) => void;
  data: SearchResponse;
  theme?: ResolvedTheme;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onDetails: (listing: Listing, opener: HTMLButtonElement) => void;
}

/** Coordinate map/list selection using only the current API page and a composite key. */
export function MapExplorer({ data, selectedKey, onSelect, onDetails, theme = 'light', mobile = false, onPage }: MapExplorerProps) {
  const selected = data.items.find(listing => listingKey(listing) === selectedKey);
  // Focus metadata does not choose the selected record; selectedKey remains the sole authority.
  const originCardKey = useRef<string | null>(null);
  const results = useRef<HTMLDivElement>(null);
  const mapPane = useRef<HTMLElement>(null);
  const selectionHeading = useRef<HTMLHeadingElement>(null);
  const mobileHeading = useRef<HTMLHeadingElement>(null);
  const browse = useRef<HTMLButtonElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const previousSelection = useRef<string | null>(null);

  useEffect(() => {
    if (mobile) {
      // Keep Previous/Next focus stable; marker selection deliberately enters the selected card.
      if (selected && !document.activeElement?.closest('.mobile-map-card')) mobileHeading.current?.focus({ preventScroll: true });
      else if (!selected && previousSelection.current) browse.current?.focus({ preventScroll: true });
      previousSelection.current = selectedKey;
      return;
    }
    const restoredCard = originCardKey.current ? [...(results.current?.querySelectorAll<HTMLElement>('[data-listing-key]') ?? [])]
      .find(item => item.dataset.listingKey === originCardKey.current)?.querySelector<HTMLButtonElement>('.listing-open') : null;
    const returnTarget = restoredCard ?? mapPane.current?.querySelector<HTMLButtonElement>('[aria-label="Fit visible listings"]') ?? listHeading.current;
    const target = selected ? selectionHeading.current : previousSelection.current ? returnTarget : null;
    target?.focus({ preventScroll: true });
    // A card near the end of the list may have been replaced by a featured card at its start.
    target?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    previousSelection.current = selectedKey;
  }, [selectedKey, selected, mobile]);

  const remaining = selected ? data.items.filter(listing => listingKey(listing) !== selectedKey) : data.items;
  return <>
    <aside ref={mapPane} className="map-pane" aria-label="Property map">
      <MapBoundary>
        <Suspense fallback={<div className="map-fallback" role="status">Preparing your map…</div>}>
          <ListingMap mobile={mobile} theme={theme} listings={data.items} selectedKey={selectedKey}
            onSelect={key => { originCardKey.current = null; onSelect(key); }} />
        </Suspense>
      </MapBoundary>
    </aside>
    {mobile && <MobileMapDeck data={data} selected={selected} heading={mobileHeading} browse={browse}
      onSelect={onSelect} onDetails={onDetails} onPage={onPage} />}
    <div hidden={mobile} ref={results} className="map-results" tabIndex={0} role="region" aria-label="Homes on the map">
      <div className="map-scope"><span className="eyebrow">HAVEN Atlas</span>
        <p>Showing {data.items.length} of {data.totalCount} matching properties.</p>
        <p>Page {data.page} of {data.totalPages}</p></div>
      <p className="visually-hidden" role="status" aria-atomic="true">{selected && `Selected ${selected.address}, ${selected.source} / ${selected.id}.`}</p>
      {selected && <section className="map-selection" aria-labelledby="map-selection-heading">
        <div className="map-selection-heading"><h3 id="map-selection-heading" ref={selectionHeading} tabIndex={-1}>Selected property</h3>
          <button type="button" className="text-button" onClick={() => onSelect(null)}>Close selection <span aria-hidden="true">×</span></button></div>
        {/* Only featured content remounts per identity; Leaflet and the focus heading stay mounted. */}
        <div key={listingKey(selected)} className="map-featured-content">
          <ListingCard listing={selected} variant="featured" onOpen={onDetails} />
        </div>
      </section>}
      <h3 className="map-list-heading" ref={listHeading} tabIndex={-1}>{selected ? 'Other matching homes' : 'Homes on this page'}</h3>
      <p className="map-list-note">Select a card or map marker to explore. Property imagery is illustrative.</p>
      {remaining.length ? <ol className="listing-grid map-compact-grid" aria-label={selected ? 'Other matching homes' : 'Homes on this page'}>
        {remaining.map(listing => <li key={listingKey(listing)} data-listing-key={listingKey(listing)}>
          <ListingCard listing={listing} variant="compact" action="select"
            onOpen={item => { originCardKey.current = listingKey(item); onSelect(originCardKey.current); }} />
        </li>)}
      </ol> : <p className="map-list-note">There are no other homes on this result page.</p>}
    </div>
  </>;
}
