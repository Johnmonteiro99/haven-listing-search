import { expect, it, vi } from 'vitest';
import samples from '../../../data/sample_listings.json';
import { getDistributionPrices } from './priceDistribution';

const items = samples.map(item => ({ ...item, relevanceScore: 50 }));
function data(page = 1) { return { items: items.slice((page - 1) * 10, page * 10), page, pageSize: 10, totalCount: 12, totalPages: 2 }; }
const response = (value: unknown) => new Response(JSON.stringify(value));
it('collects sequential real-sized pages including distinct source records rather than only the current page', async () => {
  let resolveSecond!: (response: Response) => void;
  const fetchMock = vi.fn().mockResolvedValueOnce(response(data())).mockImplementationOnce(() => new Promise<Response>(resolve => { resolveSecond = resolve; }));
  vi.stubGlobal('fetch', fetchMock);
  const pending = getDistributionPrices({ city: 'Springfield', minBedrooms: 2, keyword: 'CONDO' }, new AbortController().signal);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
    '/api/listings?minBedrooms=2&city=Springfield&keyword=CONDO&page=1&pageSize=10',
    '/api/listings?minBedrooms=2&city=Springfield&keyword=CONDO&page=2&pageSize=10',
  ]);
  resolveSecond(response(data(2)));
  expect(await pending).toEqual(items.map(item => item.price));
});
it('returns no prices for a genuine empty city without requesting another page', async () => {
  const fetchMock = vi.fn().mockResolvedValue(response({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getDistributionPrices({ city: 'Boston' }, new AbortController().signal)).toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each(['limit', 'changed', 'duplicate', 'incomplete'])('rejects %s data instead of showing a partial histogram', async kind => {
  const first = kind === 'limit' ? { ...data(), totalCount: 1010, totalPages: 101 } : data();
  const second = kind === 'changed' ? { ...data(2), totalCount: 11 } : kind === 'duplicate' ? { ...data(2), items: items.slice(0, 2) } : { ...data(2), items: [] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(first)).mockResolvedValueOnce(response(second)));
  await expect(getDistributionPrices({}, new AbortController().signal)).rejects.toThrow();
});
it('stops collecting when a transport resolves after cancellation', async () => {
  const controller = new AbortController();
  const fetchMock = vi.fn().mockImplementation(() => { controller.abort(); return Promise.resolve(response(data())); });
  vi.stubGlobal('fetch', fetchMock);
  await expect(getDistributionPrices({}, controller.signal)).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
