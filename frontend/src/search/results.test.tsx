import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import samples from '../../../data/sample_listings.json';
import type { Listing, SearchResponse } from '../api/listings';
import { getListingImage } from '../assets/listingImage';
import { imageAssets } from '../assets/images';
import { ListingCard } from '../components/ListingCard';
import { SearchResults } from '../components/SearchResults';
import { SearchPanel } from '../components/SearchPanel';
import { Pagination } from '../components/Pagination';
import App from '../App';

const listings: Listing[] = samples.map(sample => ({ ...sample, status: sample.status as Listing['status'], relevanceScore: 87.94666666666667 }));
const firstPage: SearchResponse = { items: listings.slice(0, 10), totalCount: 12, page: 1, pageSize: 10, totalPages: 2 };
const secondPage: SearchResponse = { ...firstPage, items: listings.slice(10), page: 2 };
const emptyPage: SearchResponse = { items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 };
const callbacks = { onPage: vi.fn(), onClear: vi.fn(), onRetry: vi.fn() };
function response(data: SearchResponse) { return new Response(JSON.stringify(data)); }
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  Object.values(callbacks).forEach(callback => callback.mockClear());
});

it('renders actual listing values, formatted dollars, fractional bathrooms and score', () => {
  const { container } = render(<ListingCard listing={{ ...listings[0], sqft: 1980 }} />);
  expect(screen.getByRole('article')).toHaveAccessibleName('123 Main St, Apt 4B');
  for (const text of ['$450,000', 'Springfield, VA', '2 bedrooms', '1.5 bathrooms', '1,980 sq ft', 'active', 'MLS source: MLS_A', '87.9 / 100']) {
    expect(screen.getByText(text)).toBeInTheDocument();
  }
  expect(listings[0].relevanceScore).toBe(87.94666666666667);
  const image = container.querySelector('img');
  expect(image).toHaveAttribute('alt', '');
  expect(image).toHaveAttribute('loading', 'lazy');
  expect(image).toHaveAttribute('width', '800');
  expect(image).toHaveAttribute('srcset', expect.stringContaining('480w'));
});

it('keeps image assignment stable across reorder, filtering, rerender, and pagination', () => {
  const original = new Map(listings.map(item => [JSON.stringify([item.source, item.id]), getListingImage(item.source, item.id)]));
  for (const item of [...listings].reverse().filter(item => item.price < 550000)) {
    expect(getListingImage(item.source, item.id)).toBe(original.get(JSON.stringify([item.source, item.id])));
  }
  const { container, rerender } = render(<ListingCard listing={listings[0]} />);
  const src = container.querySelector('img')?.getAttribute('src');
  rerender(<ListingCard listing={{ ...listings[0], relevanceScore: 22 }} />);
  expect(container.querySelector('img')).toHaveAttribute('src', src!);
  expect(imageAssets.propertyResponsive).toContain(getListingImage('MLS_A', 'A1'));
  // A composite identity must not collapse feeds or ambiguous concatenations.
  expect(getListingImage('MLS_A', 'A1')).not.toBe(getListingImage('MLS_B', 'A1'));
  expect(getListingImage('ab', 'c')).not.toBe(getListingImage('a', 'bc'));
});

it('renders API order and count, both source records, and recency-only explanation', () => {
  render(<SearchResults view="grid" onViewChange={() => {}} request={{ status: 'success', data: firstPage }} {...callbacks} />);
  expect(screen.getByText('12 homes match your search.')).toBeInTheDocument();
  expect(screen.getByText(/Page 1 of 2.*Showing 1–10 of 12/)).toBeInTheDocument();
  expect(screen.getAllByRole('article').map(article => article.querySelector('h3')?.textContent)).toEqual(firstPage.items.map(item => item.address));
  expect(screen.getByText(/based on listing recency/)).toBeInTheDocument();
  expect(screen.queryByText(/70% budget/)).not.toBeInTheDocument();
  expect(screen.getByText('Property imagery is illustrative.')).toBeInTheDocument();
  expect(screen.getByText('123 Main St, Apt 4B')).toBeInTheDocument();
  expect(screen.getByText('123 Main Street, Unit 4B')).toBeInTheDocument();
});

it('explains weighted relevance only for an applied target budget', () => {
  render(<SearchResults view="grid" onViewChange={() => {}} request={{ status: 'success', data: firstPage }} targetBudget={500000} {...callbacks} />);
  expect(screen.getByText(/70% budget proximity and 30% listing recency/)).toBeInTheDocument();
});

it('navigates real API pages with active criteria, ignores draft edits, and resets on search', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(response(new URL(url, 'http://localhost').searchParams.get('page') === '2' ? secondPage : firstPage)));
  vi.stubGlobal('fetch', fetchMock); render(<SearchPanel />);
  await screen.findByText(/Page 1 of 2/);
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } });
  fireEvent.click(screen.getByText(/More filters/));
  fireEvent.change(screen.getByLabelText('Target budget'), { target: { value: '500000' } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply filters' }));
  await screen.findByText(/Page 1 of 2/);
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Unsubmitted city' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText(/Page 2 of 2.*Showing 11–12 of 12/);
  expect(fetchMock.mock.lastCall?.[0]).toBe('/api/listings?city=Springfield&targetBudget=500000&page=2&pageSize=10');
  expect(screen.getByRole('heading', { name: 'A place for what comes next.' })).toHaveFocus();
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  await screen.findByText(/Page 1 of 2/);
  expect(screen.getAllByRole('article')).toHaveLength(10);
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
  await screen.findByText(/Page 2 of 2/);
  fireEvent.submit(screen.getByRole('form'));
  await screen.findByText(/Page 1 of 2/);
  expect(fetchMock.mock.lastCall?.[0]).toContain('city=Unsubmitted+city&targetBudget=500000&page=1&pageSize=10');
});

it('provides bounded page numbers and disables both directions for a single page', () => {
  const { rerender } = render(<Pagination data={{ ...firstPage, page: 500, totalPages: 1000 }} onPage={callbacks.onPage} />);
  expect(screen.getAllByRole('button')).toHaveLength(7);
  expect(screen.getByRole('button', { name: 'Page 500' })).toHaveAttribute('aria-current', 'page');
  rerender(<Pagination data={{ ...firstPage, totalPages: 1 }} onPage={callbacks.onPage} />);
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
});

it('shows accessible loading feedback and hides decorative skeletons', () => {
  const { container } = render(<SearchResults view="grid" onViewChange={() => {}} request={{ status: 'loading' }} {...callbacks} />);
  expect(screen.getByText('Loading homes…').closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  expect(container.querySelector('.skeleton-grid')).toHaveAttribute('aria-hidden', 'true');
  expect(container.querySelector('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('clears filters from the empty results action and loads defaults', async () => {
  const fetchMock = vi.fn().mockImplementationOnce(() => Promise.resolve(response(emptyPage))).mockImplementation(() => Promise.resolve(response(firstPage)));
  vi.stubGlobal('fetch', fetchMock); render(<SearchPanel />);
  await screen.findByText(/No homes match/);
  const results = screen.getByRole('region', { name: 'A place for what comes next.' });
  fireEvent.click(within(results).getByRole('button', { name: 'Clear filters' }));
  await screen.findByText('12 homes match your search.');
  expect(fetchMock.mock.lastCall?.[0]).toBe('/api/listings?page=1&pageSize=10');
});

it('preserves out-of-range metadata and offers a useful first page recovery', () => {
  render(<SearchResults view="grid" onViewChange={() => {}} request={{ status: 'success', data: { ...firstPage, items: [], page: 9 } }} {...callbacks} />);
  expect(screen.getByText(/Page 9 of 2/)).toBeInTheDocument();
  expect(screen.getByText('This page has no listings.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Back to first page' }));
  expect(callbacks.onPage).toHaveBeenCalledWith(1);
});

it('shows request errors with retry and no stale property cards', () => {
  render(<SearchResults view="grid" onViewChange={() => {}} request={{ status: 'error', message: 'Search unavailable.', validation: false }} {...callbacks} />);
  expect(screen.getByText('Search unavailable.')).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
  expect(callbacks.onRetry).toHaveBeenCalledOnce();
});

it('has no automated semantic accessibility violations with actual cards and pagination', async () => {
  const { container } = render(<main><SearchResults view="grid" onViewChange={() => {}} request={{ status: 'success', data: firstPage }} {...callbacks} /></main>);
  const result = await axe.run(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, rules: { 'color-contrast': { enabled: false } } });
  expect(result.violations).toEqual([]);
});


it('keeps the current page, mounted cards, and unsent input through theme switches and Auto', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(response(
    url.includes('page=2') ? secondPage : firstPage,
  )));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByText(/Showing 1–10 of 12/);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText(/Showing 11–12 of 12/);
  const card = screen.getAllByRole('article')[0];
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Unsubmitted city' } });
  const requestCount = fetchMock.mock.calls.length;
  fireEvent.click(screen.getByRole('switch'));
  fireEvent.click(screen.getByRole('switch'));
  fireEvent.click(screen.getByRole('button', { name: 'Auto: use system appearance' }));
  expect(screen.getByText(/Showing 11–12 of 12/)).toBeInTheDocument();
  expect(screen.getAllByRole('article')[0]).toBe(card);
  expect(screen.getByLabelText('City')).toHaveValue('Unsubmitted city');
  expect(fetchMock).toHaveBeenCalledTimes(requestCount);
});
