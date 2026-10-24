import { useEffect, useRef, useState } from 'react';
import { MapExplorer } from '../map/MapExplorer';
import type { Listing, SearchResponse } from '../api/listings';
import type { AppearanceControlProps } from './AppearanceControl';
import { ListingDetails } from './ListingDetails';
import type { RequestState } from '../search/useListingSearch';
import { ListingCard } from './ListingCard';
import { ResultsViewToggle, type ResultsView } from './ResultsViewToggle';
import { Pagination } from './Pagination';
import { DelayedLoadingNote } from './DelayedLoadingNote';

interface SearchResultsProps {
  mobileMap?: boolean;
  view: ResultsView;
  onViewChange: (view: ResultsView) => void;
  stickyVisible?: boolean;
  appearance?: AppearanceControlProps;
  request: RequestState;
  targetBudget?: number;
  onPage: (page: number) => void;
  onClear: () => void;
  onRetry: () => void;
}

/** Render the server's ranked page directly, with one live summary and deliberate recovery states. */
export function SearchResults({ request, targetBudget, onPage, onClear, onRetry, appearance, view, onViewChange, stickyVisible = false, mobileMap = false }: SearchResultsProps) {
  const [details, setDetails] = useState<{ listing: Listing; opener: HTMLButtonElement } | null>(null);
  const [selectedListing, setSelectedListing] = useState<{ key: string; data: SearchResponse } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const data = request.status === 'success' ? request.data : null;
  // Suppress stale selection immediately; clear stored selection for the next request too.
  const selectedKey = selectedListing?.data === data ? selectedListing.key : null;
  useEffect(() => { setSelectedListing(null); setDetails(null); }, [request]);
  useEffect(() => { if (view === 'grid') setSelectedListing(null); }, [view]);
  const busy = request.status === 'loading' || request.status === 'searching';
  function focusResults() {
    // The clicked control is removed during loading; retain a useful keyboard location.
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function changePage(page: number) {
    onPage(page);
    focusResults();
  }
  let message = request.status === 'loading' ? 'Loading homes…' : 'Searching homes…';
  if (request.status === 'error') message = `${request.validation ? 'Check your filters: ' : ''}${request.message}`;
  if (data) message = data.totalCount === 0 ? 'No homes match your search. Try adjusting your filters.' :
    `${data.totalCount} ${data.totalCount === 1 ? 'home matches' : 'homes match'} your search.`;
  return <section className="search-results" aria-labelledby={mobileMap ? 'mobile-results-heading' : 'results-heading'}>
    {mobileMap && <h2 id="mobile-results-heading" className="visually-hidden" ref={heading} tabIndex={-1}>Map search results</h2>}
    <div className="results-heading" hidden={mobileMap}>
      <div><h2 id="results-heading" tabIndex={-1} ref={mobileMap ? undefined : heading}>A place for what comes next.</h2>
        <p className="results-introduction">Explore homes that bring your next chapter a little closer.</p></div>
      <div className="results-view-controls">
        <p className="imagery-note">Property imagery is illustrative.</p>
        <div className="results-view-slot"><div hidden={stickyVisible}><ResultsViewToggle view={view} onChange={onViewChange} /></div></div>
      </div>
    </div>
    <div className={`results-metadata${mobileMap ? ' visually-hidden' : ''}`}>
      <div className="results-summary" aria-live="polite" aria-atomic="true">
        <p>{message}</p>
        {data && <p className="page-summary">{data.totalPages === 0 ? `0 pages · Requested page ${data.page}` : `Page ${data.page} of ${data.totalPages}`} · {data.pageSize} per page
          {data.items.length > 0 && ` · Showing ${(data.page - 1) * data.pageSize + 1}–${(data.page - 1) * data.pageSize + data.items.length} of ${data.totalCount}`}</p>}
      </div>
      <details hidden={mobileMap} className="relevance-info" onKeyDown={event => {
        if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
      }}>
        <summary><span aria-hidden="true">ⓘ</span> How relevance works</summary>
        <p id="ranking-explanation" className="ranking-explanation">{targetBudget === undefined ?
          'Relevance is scored out of 100, based on listing recency.' :
          'Relevance is scored out of 100: 70% budget proximity and 30% listing recency.'} Scores are rounded for display.</p>
      </details>
    </div>
    <DelayedLoadingNote request={request} />
    <div id="results-workspace" className={`results-workspace${view === 'map' ? ' is-map' : ''}`} data-view={view} aria-busy={busy}>
      {view === 'map' && (!data || !data.items.length) && <aside className="map-pane" aria-label="Property map">
        <div className="map-fallback" role="status">{busy ? 'Updating the map for your search…' :
          request.status === 'error' ? 'The map will return when your search succeeds.' : 'There are no locations on this result page.'}</div>
      </aside>}
      {busy && <div className="listing-grid skeleton-grid" aria-hidden="true">{[0, 1, 2].map(key => <div className="listing-skeleton" key={key}><div /><span /><span /><span /></div>)}</div>}
      {request.status === 'error' && <div className="results-empty"><button className="primary-button" type="button" onClick={() => { onRetry(); focusResults(); }}>Retry search</button></div>}
      {data && data.totalCount === 0 && <div className="results-empty"><h3>A fresh start.</h3><p>Broaden your price range or explore another city.</p><button className="primary-button" type="button" onClick={() => { onClear(); focusResults(); }}>Clear filters</button></div>}
      {data && data.totalCount > 0 && data.items.length === 0 && <div className="results-empty"><h3>This page has no listings.</h3><p>Your search still has {data.totalCount} matching homes. Return to an available page.</p><button className="primary-button" type="button" onClick={() => changePage(1)}>Back to first page</button></div>}
      {data && data.items.length > 0 && view === 'map' && <MapExplorer mobile={mobileMap} onPage={changePage} theme={appearance?.theme} data={data} selectedKey={selectedKey}
        onSelect={key => setSelectedListing(key === null ? null : { key, data })}
        onDetails={(listing, opener) => setDetails({ listing, opener })} />}
      {data && data.items.length > 0 && view === 'grid' && <ol className="listing-grid" aria-label="Ranked homes" start={(data.page - 1) * data.pageSize + 1}>
        {data.items.map(listing => <li key={JSON.stringify([listing.source, listing.id])}><ListingCard listing={listing} onOpen={(listing, opener) => setDetails({ listing, opener })} /></li>)}
      </ol>}
    </div>
    {details && <ListingDetails listing={details.listing} opener={details.opener}
      targetBudget={targetBudget} appearance={appearance} onClose={() => setDetails(null)} />}
    {data && !mobileMap && <Pagination data={data} onPage={changePage} />}
  </section>;
}
