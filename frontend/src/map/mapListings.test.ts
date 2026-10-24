import { expect, it } from 'vitest';
import samples from '../../../data/sample_listings.json';
import type { Listing } from '../api/listings';
import { groupMapLocations, listingKey } from './mapListings';

const listings: Listing[] = samples.map(item => ({ ...item, status: item.status as Listing['status'], relevanceScore: 50 }));

it('groups real coordinates without hiding or modifying any MLS record', () => {
  const original = JSON.stringify(listings);
  const groups = groupMapLocations(listings);
  expect(groups).toHaveLength(8);
  expect(groups.flatMap(group => group.listings)).toHaveLength(12);
  expect(groups[0].position).toEqual([38.7893, -77.1873]);
  expect(groups[0].listings.map(listingKey)).toEqual(['["MLS_A","A1"]', '["MLS_B","B7"]']);
  expect(groups[0].listings[0]).toBe(listings[0]);
  expect(JSON.stringify(listings)).toBe(original);
});

it('keeps composite identities unambiguous and does not group different coordinates', () => {
  expect(listingKey({ source: 'ab', id: 'c' })).not.toBe(listingKey({ source: 'a', id: 'bc' }));
  expect(listingKey({ source: 'MLS_A', id: 'A1' })).not.toBe(listingKey({ source: 'MLS_B', id: 'A1' }));
  expect(groupMapLocations([listings[0], { ...listings[0], source: 'MLS_B', longitude: -77.2 }])).toHaveLength(2);
});

it('omits invalid coordinates from the map without changing the supplied listing collection', () => {
  const invalid = [NaN, Infinity, 91].map(latitude => ({ ...listings[0], latitude }));
  const items = [...invalid, { ...listings[0], longitude: -181 }, { ...listings[0], latitude: 0, longitude: 0 }];
  expect(groupMapLocations(items).map(group => group.position)).toEqual([[0, 0]]);
  expect(items).toHaveLength(5);
  expect(groupMapLocations([])).toEqual([]);
});
