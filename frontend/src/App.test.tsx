import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import App from './App';

it('loads search results without exposing development health status', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(
    { items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 },
  ))));
  vi.stubGlobal('fetch', fetchMock);
  const { container } = render(<App />);
  expect(await screen.findByText('No homes match your search. Try adjusting your filters.')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/listings?page=1&pageSize=10', { signal: expect.any(AbortSignal) });
  expect(fetchMock.mock.calls.every(([url]) => url !== '/api/health')).toBe(true);
  expect(screen.queryByText(/Backend status|Checking backend/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Discover' })).toHaveAttribute('href', '#search');
  expect(container.querySelector('#search')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Relevance scoring' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next feature' }));
  expect(screen.getByRole('heading', { name: 'Thoughtful filters' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next feature' }));
  expect(screen.getByRole('heading', { name: 'Clearer decisions' })).toBeInTheDocument();
});

it('keeps actual search failures visible with retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Retry search' })).toBeInTheDocument();
  expect(screen.getByText(/Search is unavailable/)).toBeInTheDocument();
});

it('switches the lazy decorative footer image without changing its reserved geometry', () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})));
  const { container } = render(<App />);
  const image = container.querySelector('.perspective-image img');
  expect(image).toHaveAttribute('alt', '');
  expect(image).toHaveAttribute('loading', 'lazy');
  expect(image).toHaveAttribute('width', '1024');
  expect(image).toHaveAttribute('height', '576');
  expect(image).toHaveAttribute('src', '/images/footer/footer-light-1024.webp');
  fireEvent.click(screen.getByRole('switch', { name: 'Dark appearance' }));
  expect(container.querySelector('.perspective-image img')).toBe(image);
  expect(container.querySelectorAll('.perspective-image img')[1]).toHaveAttribute('src', '/images/footer/footer-dark-1024.webp');
});
