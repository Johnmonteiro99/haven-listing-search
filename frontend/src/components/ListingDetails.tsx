import { useEffect, useId, useRef } from 'react';
import type { Listing } from '../api/listings';
import { getListingImage } from '../assets/listingImage';
import { AppearanceControl, type AppearanceControlProps } from './AppearanceControl';
import { currency, number } from './listingPresentation';

interface ListingDetailsProps {
  listing: Listing;
  opener: HTMLButtonElement;
  targetBudget?: number;
  appearance?: AppearanceControlProps;
  onClose: () => void;
}

const listedDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

/** Read the selected API record directly; native modality owns focus containment and Escape. */
export function ListingDetails({ listing, opener, targetBudget, appearance, onClose }: ListingDetailsProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const image = getListingImage(listing.source, listing.id);

  useEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      // The exact source/id card remains mounted through theme changes.
      if (opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener]);

  return <dialog ref={dialog} className="property-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="property-toolbar">
      {appearance ? <AppearanceControl {...appearance} /> : <span className="eyebrow">Property details</span>}
      <button ref={closeButton} type="button" className="property-close secondary-button" onClick={onClose}
        aria-label="Close property details">Close <span aria-hidden="true">×</span></button>
    </div>
    <div className="property-scroll">
      <figure className="property-illustration">
        <img src={image.large} srcSet={`${image.small} 480w, ${image.large} 800w`}
          sizes="(min-width: 768px) 640px, 100vw" width="800" height="600" alt=""
          decoding="async" style={{ objectPosition: image.position }} />
        <figcaption>Property imagery is illustrative, not a photograph of this listing.</figcaption>
      </figure>
      <div className="property-content">
        <header className="property-intro">
          <p className="eyebrow">Property details <span aria-hidden="true"> / </span><span className="listing-status">{listing.status}</span></p>
          <p className="property-price">{currency.format(listing.price)}</p>
          <h2 id={titleId}>{listing.address}</h2>
          <p className="property-location">{listing.city}, {listing.state} {listing.zip}</p>
        </header>
        <dl className="property-facts">
          <div><dt>Bedrooms</dt><dd>{number.format(listing.bedrooms)}</dd></div>
          <div><dt>Bathrooms</dt><dd>{number.format(listing.bathrooms)}</dd></div>
          <div><dt>Square feet</dt><dd>{number.format(listing.sqft)}</dd></div>
        </dl>
        <section className="property-description" aria-label="Listing description">
          <h3>About this property</h3>
          <p>{listing.description}</p>
        </section>
        <section className="property-relevance" aria-label="Listing relevance">
          <div className="property-score"><h3>Relevance score</h3>
            <p><strong>{listing.relevanceScore.toFixed(1)}</strong><span> / 100</span></p></div>
          <p>{targetBudget === undefined ? 'Based on listing recency.' : `Based on proximity to your ${currency.format(targetBudget)} target budget and listing recency.`} Rounded for display.</p>
          <details><summary>How this score works</summary>
            {targetBudget !== undefined && <p>Budget proximity contributes 70% and listing recency contributes 30%. Prices equally far above or below your target budget receive the same budget score.</p>}
            <p>{targetBudget === undefined ? 'Without a target budget, recency determines the full score. ' : ''}Recency decreases linearly over 180 days; future listing dates count as new. The server uses one UTC reference date per search.</p>
            <p>This is the score returned with your search results. It is not a property valuation or a percentage match.</p>
          </details>
        </section>
        <section className="property-provenance" aria-label="Listing record">
          <h3>Listing record</h3>
          <dl>
            <div><dt>Status</dt><dd>{listing.status}</dd></div>
            <div><dt>MLS source</dt><dd>{listing.source}</dd></div>
            <div><dt>Listing ID</dt><dd>{listing.id}</dd></div>
            <div><dt>Listed date</dt><dd><time dateTime={listing.listedDate}>{listedDate.format(new Date(`${listing.listedDate}T00:00:00Z`))}</time></dd></div>
          </dl>
          <p>Source and listing ID identify this record. Listings from different feeds remain separate.</p>
        </section>
      </div>
    </div>
  </dialog>;
}
