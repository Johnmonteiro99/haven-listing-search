import type { RefObject } from 'react';
import type { Listing, SearchResponse } from '../api/listings';
import { getListingImage } from '../assets/listingImage';
import { currency, number } from '../components/listingPresentation';
import { listingKey } from './mapListings';

interface MobileMapDeckProps {
  data: SearchResponse;
  selected?: Listing;
  heading: RefObject<HTMLHeadingElement | null>;
  browse: RefObject<HTMLButtonElement | null>;
  onSelect: (key: string | null) => void;
  onDetails: (listing: Listing, opener: HTMLButtonElement) => void;
  onPage: (page: number) => void;
}

/** Current-page browsing uses the same selected key as markers, without fetching or moving the map. */
export function MobileMapDeck({ data, selected, heading, browse, onSelect, onDetails, onPage }: MobileMapDeckProps) {
  const index = selected ? data.items.findIndex(item => listingKey(item) === listingKey(selected)) : -1;
  const image = selected ? getListingImage(selected.source, selected.id) : null;
  const prices = data.items.map(item => item.price);
  const range = prices.length ? `${currency.format(Math.min(...prices))}–${currency.format(Math.max(...prices))}` : '';
  function next(offset: number) {
    onSelect(listingKey(data.items[(index + offset + data.items.length) % data.items.length]));
  }
  return <div className="mobile-map-bottom">
    <p className="visually-hidden" role="status" aria-atomic="true">{selected && `Property ${index + 1} of ${data.items.length}: ${selected.address}, ${selected.source} / ${selected.id}.`}</p>
    {selected && image && <article className="mobile-map-card" aria-labelledby="mobile-property-heading">
      <div className="mobile-map-card-image">
        <img src={image.large} srcSet={`${image.small} 480w, ${image.large} 800w`} sizes="(max-width: 767px) 90vw, 340px"
          width="800" height="600" alt="" style={{ objectPosition: image.position }} />
        <span className="mobile-map-illustration">Illustrative image</span>
        <button className="mobile-map-close" type="button" aria-label="Close selected property" onClick={() => onSelect(null)}>×</button>
        {data.items.length > 1 && <>
          <button className="mobile-map-previous" type="button" aria-label="Previous property" onClick={() => next(-1)}>‹</button>
          <button className="mobile-map-next" type="button" aria-label="Next property" onClick={() => next(1)}>›</button>
        </>}
      </div>
      <div className="mobile-map-card-body">
        <p className="mobile-map-price">{currency.format(selected.price)}</p>
        <h3 id="mobile-property-heading" ref={heading} tabIndex={-1}>{selected.address}</h3>
        <p className="mobile-map-location">{selected.city}, {selected.state}</p>
        <ul className="mobile-map-facts" aria-label="Property facts">
          <li>{number.format(selected.bedrooms)} beds</li><li>{number.format(selected.bathrooms)} baths</li><li>{number.format(selected.sqft)} sq ft</li>
        </ul>
        <div className="mobile-map-card-action"><span>{index + 1} of {data.items.length} · {selected.source} / {selected.id}</span>
          <button type="button" aria-haspopup="dialog" aria-label={`View details for ${selected.address} (${selected.source}, ${selected.id})`}
            onClick={event => onDetails(selected, event.currentTarget)}>View details <span aria-hidden="true">↗</span></button></div>
      </div>
    </article>}
    <nav className="mobile-map-dock" aria-label="Map results and pages">
      <button type="button" aria-label="Previous page" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>‹</button>
      <button ref={browse} className="mobile-map-summary" type="button" aria-expanded={Boolean(selected)}
        aria-label={`${selected ? 'Hide selected property' : 'Browse homes on this page'}. ${data.items.length} on page ${data.page} of ${data.totalPages}, ${data.totalCount} matching homes.`}
        onClick={() => onSelect(selected ? null : listingKey(data.items[0]))}>
        <strong>{data.items.length} on this page <span>· {data.totalCount} matches</span></strong>
        <span>{range}</span><span className="visually-hidden">Page {data.page} of {data.totalPages}</span>
      </button>
      <button type="button" aria-label="Next page" disabled={data.page >= data.totalPages} onClick={() => onPage(data.page + 1)}>›</button>
    </nav>
  </div>;
}
