import { useId } from 'react';
import type { Listing } from '../api/listings';
import { currency, number } from './listingPresentation';
import { getListingImage } from '../assets/listingImage';

interface ListingCardProps {
  listing: Listing;
  onOpen?: (listing: Listing, opener: HTMLButtonElement) => void;
  variant?: 'default' | 'compact' | 'featured';
  action?: 'details' | 'select';
}

/** Display server facts unchanged; variants change density, never listing values. */
export function ListingCard({ listing, onOpen, variant = 'default', action = 'details' }: ListingCardProps) {
  const headingId = useId();
  const image = getListingImage(listing.source, listing.id);
  return <article className={`listing-card${variant === 'default' ? '' : ` listing-card-${variant}`}`} aria-labelledby={headingId}>
    <div className="listing-image-frame">
      <img src={image.large} srcSet={`${image.small} 480w, ${image.large} 800w`}
        sizes={variant === 'compact' ? '(min-width: 1200px) 205px, (min-width: 768px) 46vw, 92vw' : variant === 'featured' ? '(min-width: 1200px) 580px, 92vw' : '(min-width: 1200px) 420px, (min-width: 768px) 46vw, 92vw'}
        width="800" height="600" loading="lazy" decoding="async" alt=""
        style={{ objectPosition: image.position }} />
      <span className="score-badge" aria-label={`Relevance score: ${listing.relevanceScore.toFixed(1)} out of 100`}
        aria-describedby="ranking-explanation">{listing.relevanceScore.toFixed(1)} / 100</span>
    </div>
    <div className="listing-body">
      <p className="listing-price">{currency.format(listing.price)}</p>
      <h3 id={headingId}>{listing.address}</h3>
      <p className="listing-location">{listing.city}, {listing.state}{variant === 'featured' && ` ${listing.zip}`}</p>
      <ul className="listing-facts" aria-label="Property details">
        <li>{number.format(listing.bedrooms)} {listing.bedrooms === 1 ? 'bedroom' : 'bedrooms'}</li>
        <li>{number.format(listing.bathrooms)} {listing.bathrooms === 1 ? 'bathroom' : 'bathrooms'}</li>
        <li>{number.format(listing.sqft)} sq ft</li>
      </ul>
      <div className="listing-source"><span className="listing-status">{listing.status}</span><span>MLS source: {listing.source}{variant === 'featured' && ` / Listing ID: ${listing.id}`}</span></div>
      {variant === 'compact' && <p className="compact-description">{listing.description}</p>}
      {variant === 'featured' && <p className="featured-description">{listing.description}</p>}
      {onOpen && <div className="listing-action"><button type="button" className="listing-open" aria-haspopup={action === 'details' ? 'dialog' : undefined}
        aria-label={`${action === 'select' ? 'Select' : 'View details for'} ${listing.address} (${listing.source}, ${listing.id})${action === 'select' ? ' on map' : ''}`}
        onClick={event => onOpen(listing, event.currentTarget)}>
        {action === 'select' ? 'Explore on map' : 'View details'} <span aria-hidden="true">↗</span>
      </button></div>}
    </div>
  </article>;
}
