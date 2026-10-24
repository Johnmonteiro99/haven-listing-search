import { expect, it, vi } from 'vitest';
import { getHealth } from './health';

// Health remains a useful diagnostic contract even without a public status badge.
it('requests and validates backend health with the caller cancellation signal', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' })));
  vi.stubGlobal('fetch', fetchMock);
  const controller = new AbortController();
  await expect(getHealth(controller.signal)).resolves.toEqual({ status: 'ok' });
  expect(fetchMock).toHaveBeenCalledWith('/api/health', { signal: controller.signal });
});

it('rejects an unsuccessful health response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await expect(getHealth()).rejects.toThrow('Health request failed (503)');
});

it('rejects malformed health data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 1 }))));
  await expect(getHealth()).rejects.toThrow('Invalid health response');
});
