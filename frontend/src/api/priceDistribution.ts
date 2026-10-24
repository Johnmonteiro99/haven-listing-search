import { getListings, type SearchParams } from './listings';

export type DistributionCriteria = Pick<SearchParams, 'city' | 'minBedrooms' | 'keyword'>;
const PAGE_SIZE = 10;
const MAX_PAGES = 100;

/** Collect complete current-context prices sequentially; never present a truncated page as a full distribution. */
export async function getDistributionPrices(criteria: DistributionCriteria, signal: AbortSignal): Promise<number[]> {
  const first = await getListings({ ...criteria, page: 1, pageSize: PAGE_SIZE }, signal);
  signal.throwIfAborted();
  if (first.totalPages > MAX_PAGES || first.totalPages !== Math.ceil(first.totalCount / PAGE_SIZE)) {
    throw new Error('Price data exceeds the supported preview size or has inconsistent pagination.');
  }
  const records = [...first.items];
  function checkPage(data: typeof first, page: number) {
    if (data.page !== page || data.pageSize !== PAGE_SIZE || data.totalCount !== first.totalCount || data.totalPages !== first.totalPages) {
      throw new Error('Price data changed while loading. Please retry.');
    }
  }
  checkPage(first, 1);
  for (let page = 2; page <= first.totalPages; page++) {
    const next = await getListings({ ...criteria, page, pageSize: PAGE_SIZE }, signal);
    signal.throwIfAborted();
    checkPage(next, page);
    records.push(...next.items);
  }
  const identities = new Set(records.map(item => JSON.stringify([item.source, item.id])));
  if (records.length !== first.totalCount || identities.size !== records.length) {
    throw new Error('Price data is incomplete or changed while loading. Please retry.');
  }
  return records.map(item => item.price);
}
