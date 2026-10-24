import { expect, it } from 'vitest';
import samples from '../../../data/sample_listings.json';
import { buildPriceHistogram, priceBinSelected } from './priceHistogram';

it('counts all supplied records in twenty equal-width bins without mutating prices', () => {
  const prices = Object.freeze(samples.map(item => item.price));
  const { bins, max } = buildPriceHistogram(prices);
  expect(max).toBe(2_000_000); expect(bins).toHaveLength(20);
  expect(bins.every(bin => bin.end - bin.start === 100000)).toBe(true);
  expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(12);
  expect(bins[4].count).toBe(prices.filter(price => price >= 400000 && price < 500000).length);
  expect(prices).toEqual(samples.map(item => item.price));
});
it('includes exact bin boundaries once, extends for expensive records, and supports no data', () => {
  expect(buildPriceHistogram([0, 100000, 2000000]).bins.filter(bin => bin.count).map(bin => bin.count)).toEqual([1, 1, 1]);
  const large = buildPriceHistogram([3_000_000]);
  expect(large.max).toBe(3000000); expect(large.bins[19].count).toBe(1);
  expect(buildPriceHistogram([]).bins.every(bin => bin.count === 0)).toBe(true);
});
it('highlights overlapping bins inclusively and excludes invalid or inverted selections', () => {
  const { bins } = buildPriceHistogram([]);
  expect(priceBinSelected(bins[4], 4, 450000, 500000)).toBe(true);
  expect(priceBinSelected(bins[5], 5, 450000, 500000)).toBe(true);
  expect(priceBinSelected(bins[3], 3, 450000, 500000)).toBe(false);
  expect(priceBinSelected(bins[4], 4, 500000, Infinity)).toBe(false);
  expect(priceBinSelected(bins[19], 19, 2000000, Infinity)).toBe(true);
  expect(priceBinSelected(bins[4], 4, null, 500000)).toBe(false);
  expect(priceBinSelected(bins[4], 4, 600000, 500000)).toBe(false);
});
