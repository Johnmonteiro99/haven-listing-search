import { afterEach, expect, it, vi } from 'vitest';
import { apiUrl, resolveApiBaseUrl } from './config';
import { getHealth } from './health';
import { getListings } from './listings';

afterEach(() => vi.unstubAllEnvs());

it('retains relative local requests and normalizes configured origins', () => {
  expect(resolveApiBaseUrl(undefined, false)).toBe('');
  expect(resolveApiBaseUrl(' http://127.0.0.1:8000/ ', false)).toBe('http://127.0.0.1:8000');
  expect(resolveApiBaseUrl('https://api.example.com/', true)).toBe('https://api.example.com');
});

it.each(['', 'http://api.example.com', 'https://localhost', 'https://127.0.0.1',
  'https://[::1]', 'https://0.0.0.0', 'https://api.example.com/api',
  'https://user:password@api.example.com', 'https://api.example.com?key=value',
  'https://api.example.com#fragment', 'https://*.example.com'])('rejects invalid production origin %s', value => {
  expect(() => resolveApiBaseUrl(value, true)).toThrow('VITE_API_BASE_URL');
});

it('routes health and listings to the production backend and preserves cancellation', async () => {
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 })));
  vi.stubGlobal('fetch', fetchMock);
  const signal = new AbortController().signal;
  await getHealth(signal);
  await getListings({ page: 1, pageSize: 10 }, signal);
  expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.com/api/health', { signal });
  expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.com/api/listings?page=1&pageSize=10', { signal });
  expect(apiUrl('/api/health')).toBe('https://api.example.com/api/health');
});
