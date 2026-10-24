export const PRICE_SLIDER_BASE_MAX = 2_000_000;
export const PRICE_BIN_COUNT = 20;

export interface PriceBin { start: number; end: number; count: number }

/** Twenty equal-width bins from zero; the final bin includes the upper endpoint. */
export function buildPriceHistogram(prices: readonly number[]) {
  const max = prices.reduce((limit, price) => Math.max(limit, price), PRICE_SLIDER_BASE_MAX);
  const width = max / PRICE_BIN_COUNT;
  const bins: PriceBin[] = Array.from({ length: PRICE_BIN_COUNT }, (_, index) => ({
    start: index * width, end: index === PRICE_BIN_COUNT - 1 ? max : (index + 1) * width, count: 0,
  }));
  for (const price of prices) bins[Math.min(PRICE_BIN_COUNT - 1, Math.floor(price / width))].count++;
  return { max, bins };
}

/** Inclusive filters intersect half-open bins; the last bin includes its right endpoint. */
export function priceBinSelected(bin: PriceBin, index: number, minimum: number | null, maximum: number | null) {
  if (minimum === null || maximum === null || minimum > maximum) return false;
  return bin.start <= maximum && (index === PRICE_BIN_COUNT - 1 ? bin.end >= minimum : bin.end > minimum);
}
