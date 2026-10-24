import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import samples from '../../../data/sample_listings.json';

vi.mock('../map/MapExplorer', () => ({ MapExplorer: () => <div>Map explorer fixture</div> }));
const observers = new Map<Element, IntersectionObserverCallback>();
const disconnect = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  observers.clear();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe(element: Element) { observers.set(element, this.callback); }
    disconnect = disconnect;
  });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  fetchMock = vi.fn().mockImplementation((url: string) => {
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page') || 1);
    return Promise.resolve(new Response(JSON.stringify({ items: samples.slice(page === 2 ? 10 : 0, page === 2 ? 12 : 10).map(item => ({ ...item, relevanceScore: 80 })), page, pageSize: 10, totalCount: 12, totalPages: 2 })));
  });
  vi.stubGlobal('fetch', fetchMock);
});
function intersect(selector: string, bottom: number, isIntersecting: boolean) {
  const target = document.querySelector(selector)!;
  act(() => observers.get(target)!([{ target, isIntersecting, boundingClientRect: { bottom } } as IntersectionObserverEntry], {} as IntersectionObserver));
}
async function start() {
  const result = render(<App />);
  await screen.findByText('12 homes match your search.');
  return result;
}
function toolbar() { return within(screen.getByRole('navigation', { name: 'Search and results controls' })); }
function reveal() { intersect('.search-panel', -12, false); }

it('reveals only after the original form passes above the viewport and hides on return or leaving results', async () => {
  const { unmount } = await start();
  expect(screen.queryByRole('navigation', { name: 'Search and results controls' })).not.toBeInTheDocument();
  intersect('.search-panel', 1200, false); // Below viewport is not a scrolled-past form.
  expect(screen.queryByRole('navigation', { name: 'Search and results controls' })).not.toBeInTheDocument();
  reveal();
  expect(toolbar().getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getAllByRole('group', { name: 'Results view' })).toHaveLength(1);
  intersect('.search-panel', 10, true);
  expect(screen.queryByRole('navigation', { name: 'Search and results controls' })).not.toBeInTheDocument();
  reveal(); intersect('#search', -20, false);
  expect(screen.queryByRole('navigation', { name: 'Search and results controls' })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  unmount(); expect(disconnect).toHaveBeenCalled();
  expect(document.documentElement).not.toHaveClass('has-sticky-search');
});

it('synchronizes city drafts in both directions without fetching or applying on hide', async () => {
  await start();
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } }); reveal();
  const city = toolbar().getByRole('textbox', { name: 'Search a city' });
  expect(city).toHaveValue('Springfield');
  fireEvent.change(city, { target: { value: 'Arlington' } });
  expect(screen.getByLabelText('City')).toHaveValue('Arlington');
  intersect('.search-panel', 15, true); reveal();
  expect(toolbar().getByRole('textbox', { name: 'Search a city' })).toHaveValue('Arlington');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('submits once from the capsule, resets pagination and preserves Map plus every supported filter', async () => {
  await start(); reveal();
  fireEvent.click(toolbar().getByRole('button', { name: 'Map' }));
  fireEvent.click(toolbar().getByRole('button', { name: 'Advanced filters' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Filters' }));
  for (const [label, value] of [['City', 'Springfield'], ['Minimum price', '100000'], ['Maximum price', '600000'], ['Exact minimum bedrooms', '2'], ['Target budget', '500000'], ['Description keyword', 'garden']]) {
    fireEvent.change(dialog.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(dialog.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText('12 homes match your search.');
  expect(toolbar().getByRole('button', { name: 'Advanced filters' })).toHaveAccessibleDescription('5 additional active filters');
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText(/Page 2 of 2/);
  const before = fetchMock.mock.calls.length;
  fireEvent.change(toolbar().getByRole('textbox', { name: 'Search a city' }), { target: { value: 'Arlington' } });
  expect(fetchMock.mock.calls).toHaveLength(before);
  fireEvent.click(toolbar().getByRole('button', { name: 'Search' }));
  await screen.findByText(/Page 1 of 2/);
  expect(fetchMock.mock.calls).toHaveLength(before + 1);
  const params = new URL(fetchMock.mock.lastCall?.[0], 'http://localhost').searchParams;
  expect(Object.fromEntries(params)).toEqual({ city: 'Arlington', minPrice: '100000', maxPrice: '600000', minBedrooms: '2', targetBudget: '500000', keyword: 'garden', page: '1', pageSize: '10' });
  expect(toolbar().getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
});

it('uses the existing validation summary when a capsule submission contains invalid draft criteria', async () => {
  await start();
  fireEvent.click(screen.getByRole('button', { name: /Price range Any price/ }));
  fireEvent.change(screen.getByLabelText('Minimum price'), { target: { value: '500000' } });
  fireEvent.change(screen.getByLabelText('Maximum price'), { target: { value: '100000' } });
  reveal(); fireEvent.submit(toolbar().getByRole('form', { name: 'City search' }));
  expect(screen.getByRole('alert')).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('Maximum price must be at least the minimum price.');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('shares advanced-filter opening and preserves draft/applied separation on dismissal', async () => {
  await start(); fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } }); reveal();
  const filters = toolbar().getByRole('button', { name: 'Advanced filters' }); fireEvent.click(filters);
  const dialog = within(screen.getByRole('dialog', { name: 'Filters' }));
  expect(dialog.getByLabelText('City')).toHaveValue('Springfield');
  fireEvent.change(dialog.getByLabelText('City'), { target: { value: 'Discard this' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Close' }));
  expect(filters).toHaveFocus(); expect(screen.getByLabelText('City')).toHaveValue('Springfield');
  expect(toolbar().getByRole('textbox', { name: 'Search a city' })).toHaveValue('Springfield');
  // The existing histogram may fetch independently; no main search with discarded values is sent.
  expect(fetchMock.mock.calls.every(([url]) => !url.includes('Discard'))).toBe(true);
});

it('keeps a single Grid/Map mode through visibility and theme changes without extra requests', async () => {
  await start();
  const map = screen.getByRole('button', { name: 'Map' }); fireEvent.click(map);
  await screen.findByText('Map explorer fixture');
  act(() => map.focus()); reveal();
  expect(toolbar().getByRole('button', { name: 'Map' })).toHaveFocus();
  fireEvent.click(screen.getByRole('switch', { name: 'Dark appearance' }));
  expect(toolbar().getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  intersect('.search-panel', 15, true);
  expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Grid' })); reveal();
  expect(toolbar().getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('restores a useful focus target when the toolbar disappears', async () => {
  await start(); reveal();
  act(() => toolbar().getByRole('textbox', { name: 'Search a city' }).focus());
  intersect('.search-panel', 20, true);
  expect(screen.getByLabelText('City')).toHaveFocus();
});

it('keeps the original form usable when IntersectionObserver is unavailable', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  await start();
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Search homes' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('navigation', { name: 'Search and results controls' })).not.toBeInTheDocument();
});

it('applies advanced filters through the shared action and preserves criteria, page and mode on theme change', async () => {
  await start(); reveal();
  fireEvent.click(toolbar().getByRole('button', { name: 'Map' }));
  fireEvent.click(toolbar().getByRole('button', { name: 'Advanced filters' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Filters' }));
  fireEvent.change(dialog.getByLabelText('City'), { target: { value: 'Springfield' } });
  fireEvent.change(dialog.getByLabelText('Target budget'), { target: { value: '500000' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText('12 homes match your search.');
  expect(toolbar().getByRole('textbox', { name: 'Search a city' })).toHaveValue('Springfield');
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText(/Page 2 of 2/);
  const calls = fetchMock.mock.calls.length;
  fireEvent.click(screen.getByRole('switch', { name: 'Dark appearance' }));
  expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
  expect(toolbar().getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  expect(fetchMock.mock.calls).toHaveLength(calls);
  expect(fetchMock.mock.lastCall?.[0]).toBe('/api/listings?city=Springfield&targetBudget=500000&page=2&pageSize=10');
  expect(toolbar().getByRole('textbox', { name: 'Search a city' })).toHaveValue('Springfield');
});
