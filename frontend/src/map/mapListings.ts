import type { Listing } from '../api/listings';

export interface MapLocation {
  position: [number, number];
  listings: Listing[];
}

/** Feed identity is never an ID alone, nor a normalized property address. */
export function listingKey(listing: Pick<Listing, 'source' | 'id'>): string {
  return JSON.stringify([listing.source, listing.id]);
}

/** Keep every co-located record at its real coordinate; never jitter or geocode it. */
export function groupMapLocations(listings: Listing[]): MapLocation[] {
  const locations = new Map<string, MapLocation>();
  for (const listing of listings) {
    // The HTTP contract guarantees finite numbers, but not geographic ranges.
    if (!Number.isFinite(listing.latitude) || !Number.isFinite(listing.longitude) ||
        Math.abs(listing.latitude) > 90 || Math.abs(listing.longitude) > 180) continue;
    const key = JSON.stringify([listing.latitude, listing.longitude]);
    let location = locations.get(key);
    if (!location) {
      location = { position: [listing.latitude, listing.longitude], listings: [] };
      locations.set(key, location);
    }
    location.listings.push(listing);
  }
  return [...locations.values()];
}
