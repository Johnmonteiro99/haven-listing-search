import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Listing } from '../api/listings';
import samples from '../../../data/sample_listings.json';
import App from '../App';
import { listingKey } from './mapListings';

// Exercise the real state owners; geometry and native Leaflet gestures belong to browser checks.
vi.mock('./ListingMap', () => ({ default: ({ listings, selectedKey, onSelect }: {
  listings: Listing[]; selectedKey: string | null; onSelect: (key: string) => void;
}) => <div aria-label="Test map">{listings.map(item => <button key={listingKey(item)}
  aria-label={`Marker ${item.source} ${item.id}`} aria-pressed={selectedKey === listingKey(item)}
  onClick={() => onSelect(listingKey(item))}>Marker</button>)}</div> }));

let resize: () => void;
let phone: boolean;
let fetchMock: ReturnType<typeof vi.fn>;
let removeMedia: ReturnType<typeof vi.fn>;
beforeEach(() => {
  phone = true; resize = () => {}; removeMedia = vi.fn();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() { return query === '(max-width: 767px)' && phone; },
    addEventListener: (_event: string, callback: () => void) => { if (query === '(max-width: 767px)') resize = callback; },
    removeEventListener: removeMedia,
  })));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  fetchMock = vi.fn(async (url: string) => {
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page') || 1);
    return new Response(JSON.stringify({ items: samples.slice(page === 2 ? 10 : 0, page === 2 ? 12 : 10)
      .map(item => ({ ...item, relevanceScore: 80 })), totalCount: 12, totalPages: 2, page, pageSize: 10 }));
  });
  vi.stubGlobal('fetch', fetchMock);
});
async function start() {
  const result = render(<App />);
  await screen.findByText('12 homes match your search.');
  fireEvent.click(screen.getByRole('button', { name: 'Map' }));
  await screen.findByRole('button', { name: 'Marker MLS_A A1' });
  return result;
}
function header() { return within(screen.getByRole('banner', { name: 'Mobile map search' })); }

it('enters the phone workspace without fetching and returns to the same Grid results', async () => {
  await start();
  expect(document.documentElement).toHaveClass('mobile-map-mode');
  expect(header().getByRole('button', { name: 'Map' })).toHaveFocus();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: /Browse homes on this page/ })).toHaveAccessibleName(/10 on page 1 of 2, 12 matching homes/);
  fireEvent.click(header().getByRole('button', { name: 'Grid' }));
  expect(document.documentElement).not.toHaveClass('mobile-map-mode');
  expect(screen.getAllByRole('article')).toHaveLength(10);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Grid' })).toHaveFocus();
});

it('keeps marker, carousel and details on the same source/id with stable navigation focus', async () => {
  await start();
  const before = JSON.stringify(samples);
  fireEvent.click(screen.getByRole('button', { name: 'Marker MLS_A A1' }));
  const card = screen.getByRole('article', { name: '123 Main St, Apt 4B' });
  expect(within(card).getByRole('heading')).toHaveFocus();
  const next = within(card).getByRole('button', { name: 'Next property' });
  next.focus(); fireEvent.click(next);
  expect(screen.getByRole('button', { name: 'Marker MLS_B B7' })).toHaveAttribute('aria-pressed', 'true');
  expect(next).toHaveFocus();
  expect(screen.getByRole('article', { name: '123 Main Street, Unit 4B' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /View details for 123 Main Street/ }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('B7')).toBeInTheDocument();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /View details for 123 Main Street/ })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Close selected property' }));
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Browse homes on this page/ })).toHaveFocus();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(samples)).toBe(before);
});

it('shares the city draft, preserves filters and only submits on Search', async () => {
  await start();
  fireEvent.change(header().getByRole('searchbox', { name: 'Search a city' }), { target: { value: 'Springfield' } });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(header().getByRole('button', { name: 'Filters' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Filters' }));
  expect(dialog.getByLabelText('City')).toHaveValue('Springfield');
  fireEvent.change(dialog.getByLabelText('Minimum price'), { target: { value: '400000' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Apply filters' }));
  await screen.findByRole('button', { name: /Browse homes on this page/ });
  fireEvent.change(header().getByRole('searchbox'), { target: { value: 'Vienna' } });
  fireEvent.click(header().getByRole('button', { name: 'Search city' }));
  await waitFor(() => expect(fetchMock.mock.lastCall?.[0]).toContain('city=Vienna'));
  const query = new URL(fetchMock.mock.lastCall![0], 'http://localhost').searchParams;
  expect(query.get('minPrice')).toBe('400000'); expect(query.get('page')).toBe('1');
  expect(header().getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
});

it('keeps selected identity on theme changes and clears it when paging to the real next page', async () => {
  await start();
  fireEvent.click(screen.getByRole('button', { name: /Browse homes on this page/ }));
  fireEvent.click(header().getByRole('switch', { name: 'Dark appearance' }));
  expect(screen.getByRole('button', { name: 'Marker MLS_A A1' })).toHaveAttribute('aria-pressed', 'true');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByRole('button', { name: /2 on page 2 of 2/ });
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: /Browse homes on this page/ })).toHaveTextContent('$415,000–$540,000');
});

it('discards modal edits, restores the exact mobile opener, and cleans up on resizing/unmount', async () => {
  const { unmount } = await start();
  const filters = header().getByRole('button', { name: 'Filters' });
  fireEvent.click(filters);
  const dialog = within(screen.getByRole('dialog', { name: 'Filters' }));
  fireEvent.change(dialog.getByLabelText('City'), { target: { value: 'Discard me' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Close' }));
  expect(filters).toHaveFocus(); expect(header().getByRole('searchbox')).toHaveValue('');
  act(() => { phone = false; resize(); });
  expect(screen.queryByRole('banner', { name: 'Mobile map search' })).not.toBeInTheDocument();
  expect(document.documentElement).not.toHaveClass('mobile-map-mode');
  expect(screen.getByRole('region', { name: 'Homes on the map' })).toBeInTheDocument();
  unmount(); expect(removeMedia).toHaveBeenCalled();
});

it('keeps the phone search usable through an empty response and clears filters to recover', async () => {
  await start();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [], totalCount: 0, totalPages: 0, page: 1, pageSize: 10 })));
  fireEvent.change(header().getByRole('searchbox'), { target: { value: 'Unknown city' } });
  fireEvent.click(header().getByRole('button', { name: 'Search city' }));
  await screen.findByRole('heading', { name: 'A fresh start.' });
  expect(screen.queryByRole('button', { name: /Browse homes/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await screen.findByRole('button', { name: /Browse homes/ });
  expect(header().getByRole('searchbox')).toHaveValue('');
});

it('retains retry and Grid access after a search failure', async () => {
  await start();
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(header().getByRole('button', { name: 'Search city' }));
  const retry = await screen.findByRole('button', { name: 'Retry search' });
  expect(header().getByRole('button', { name: 'Grid' })).toBeInTheDocument();
  fireEvent.click(retry);
  await screen.findByRole('button', { name: /Browse homes/ });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
