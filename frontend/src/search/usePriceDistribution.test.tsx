import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePriceDistribution } from './usePriceDistribution';
import { emptyFilters } from './filters';

const mock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api/priceDistribution', () => ({ getDistributionPrices: mock.get }));
afterEach(() => { vi.useRealTimers(); mock.get.mockReset(); });
async function debounce() { await act(async () => { await vi.advanceTimersByTimeAsync(300); }); }
it('debounces membership criteria only, without fetching for price, budget, or theme-like rerenders', async () => {
  vi.useFakeTimers(); mock.get.mockResolvedValue([450000, 452000]);
  const { result, rerender } = renderHook(({ draft }) => usePriceDistribution(draft, true), { initialProps: { draft: { ...emptyFilters } } });
  rerender({ draft: { ...emptyFilters, city: ' Springfield ', keyword: ' CONDO ', minBedrooms: '2', minPrice: '400000', maxPrice: '500000', targetBudget: '450000' } });
  expect(mock.get).not.toHaveBeenCalled(); await debounce();
  expect(mock.get).toHaveBeenCalledTimes(1);
  expect(mock.get).toHaveBeenCalledWith({ city: 'Springfield', keyword: 'CONDO', minBedrooms: 2 }, expect.any(AbortSignal));
  expect(result.current.state).toEqual({ status: 'ready', prices: [450000, 452000] });
  rerender({ draft: { ...emptyFilters, city: ' Springfield ', keyword: ' CONDO ', minBedrooms: '2', minPrice: '999', maxPrice: '', targetBudget: '900000' } });
  await debounce(); expect(mock.get).toHaveBeenCalledTimes(1);
});
it('suppresses stale prices immediately and ignores an old response even if abort is ignored', async () => {
  vi.useFakeTimers(); let old!: (prices: number[]) => void;
  mock.get.mockImplementationOnce(() => new Promise<number[]>(resolve => { old = resolve; })).mockResolvedValueOnce([]);
  const { result, rerender } = renderHook(({ city }) => usePriceDistribution({ ...emptyFilters, city }, true), { initialProps: { city: 'Springfield' } });
  await debounce(); const signal = mock.get.mock.calls[0][1] as AbortSignal;
  rerender({ city: 'Boston' }); expect(signal.aborted).toBe(true);
  expect(result.current.state.status).toBe('loading'); await debounce();
  expect(result.current.state).toEqual({ status: 'ready', prices: [] });
  await act(async () => old([999999])); expect(result.current.state).toEqual({ status: 'ready', prices: [] });
});
it('skips invalid bedrooms and disabled previews, then supports retry after failure', async () => {
  vi.useFakeTimers(); mock.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([470000]);
  const { result, rerender } = renderHook(({ bedrooms, enabled }) => usePriceDistribution({ ...emptyFilters, minBedrooms: bedrooms }, enabled), { initialProps: { bedrooms: '1.5', enabled: true } });
  await debounce(); expect(mock.get).not.toHaveBeenCalled(); expect(result.current.state.status).toBe('invalid');
  rerender({ bedrooms: '2', enabled: false }); await debounce(); expect(mock.get).not.toHaveBeenCalled();
  rerender({ bedrooms: '2', enabled: true }); await debounce(); expect(result.current.state.status).toBe('error');
  act(() => result.current.retry()); await debounce(); expect(result.current.state).toEqual({ status: 'ready', prices: [470000] });
});
