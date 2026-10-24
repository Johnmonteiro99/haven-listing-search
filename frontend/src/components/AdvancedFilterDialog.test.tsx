import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SearchPanel } from './SearchPanel';
import { AdvancedFilterDialog } from './AdvancedFilterDialog';
import { emptyFilters } from '../search/filters';
import samples from '../../../data/sample_listings.json';

let fetchMock: ReturnType<typeof vi.fn>;
const page = { items: samples.slice(0, 10).map(item => ({ ...item, relevanceScore: 50 })), totalCount: 12, page: 1, pageSize: 10, totalPages: 2 };
const empty = { items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 };
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(page))));
  vi.stubGlobal('fetch', fetchMock);
});
async function start() { render(<SearchPanel />); await screen.findByText('12 homes match your search.'); }
function open() { fireEvent.click(screen.getByRole('button', { name: /More filters/ })); return within(screen.getByRole('dialog', { name: 'Filters' })); }
function edit(scope: Pick<typeof screen, 'getByLabelText'>, label: string, value: string) { fireEvent.change(scope.getByLabelText(label), { target: { value } }); }

it('copies unsent main drafts, discards panel edits on Escape, and restores focus and scrolling', async () => {
  await start(); edit(screen, 'City', 'Unsent city');
  edit(screen, 'Minimum bedrooms', '5');
  const modal = open();
  expect(modal.getByLabelText('City')).toHaveValue('Unsent city');
  expect(modal.getByLabelText('Exact minimum bedrooms')).toHaveValue('5');
  expect(modal.getByRole('button', { name: 'Close' })).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  edit(modal, 'City', 'Discard me');
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('City')).toHaveValue('Unsent city');
  expect(screen.getByRole('button', { name: /More filters/ })).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('applies all six supported criteria once, preserves exact numbers, and synchronizes quick controls', async () => {
  await start(); const modal = open();
  for (const [label, value] of [['City', ' Springfield '], ['Minimum price', '2500000.25'], ['Maximum price', '4000000.75'], ['Exact minimum bedrooms', '6'], ['Target budget', '3000000.50'], ['Description keyword', ' GARDEN ']]) edit(modal, label, value);
  fireEvent.click(modal.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText('12 homes match your search.');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.lastCall?.[0]).toBe('/api/listings?minPrice=2500000.25&maxPrice=4000000.75&minBedrooms=6&city=Springfield&keyword=GARDEN&targetBudget=3000000.5&page=1&pageSize=10');
  expect(screen.getByLabelText('City')).toHaveValue(' Springfield ');
  expect(screen.getByLabelText('Minimum bedrooms')).toHaveValue('6');
  expect(screen.getByRole('button', { name: /Price range \$2,500,000.25/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  const reopened = open();
  expect(reopened.getByLabelText('Exact minimum bedrooms')).toHaveValue('6');
  expect(reopened.getByLabelText('Target budget')).toHaveValue('3000000.50');
});

it('resets only local fields until Apply and keeps the advanced bedroom shortcuts exclusive', async () => {
  await start(); edit(screen, 'City', 'Unsent'); const modal = open();
  expect(modal.queryByRole('button', { name: '4+' })).not.toBeInTheDocument();
  expect(modal.queryByRole('button', { name: '5+' })).not.toBeInTheDocument();
  fireEvent.click(modal.getByRole('button', { name: '3+' }));
  fireEvent.click(modal.getByRole('button', { name: '1+' }));
  expect(within(modal.getByRole('group', { name: 'Minimum bedrooms' })).getAllByRole('button', { pressed: true })).toHaveLength(1);
  fireEvent.click(modal.getByRole('button', { name: 'Reset all' }));
  expect(modal.getByLabelText('City')).toHaveValue('');
  expect(modal.getByLabelText('Exact minimum bedrooms')).toHaveValue('');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(modal.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText('12 homes match your search.');
  expect(fetchMock.mock.lastCall?.[0]).toBe('/api/listings?page=1&pageSize=10');
  expect(screen.getByLabelText('City')).toHaveValue('');
});

it.each([['Target budget', '0'], ['Exact minimum bedrooms', '1.5'], ['Minimum price', '-1'], ['Maximum price', 'NaN']])('keeps invalid %s open with focused feedback', async (label, value) => {
  await start(); const modal = open(); edit(modal, label, value);
  fireEvent.click(modal.getByRole('button', { name: 'Apply filters' }));
  expect(modal.getByRole('alert')).toHaveFocus();
  expect(modal.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('keeps marketplace and future categories explicitly unavailable without parameters or requests', async () => {
  await start(); const modal = open();
  expect(modal.getByRole('button', { name: 'Buy' })).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Rent', 'Property type', 'Amenities', 'Lifestyle', 'Listing preferences']) {
    const button = modal.getByRole('button', { name: new RegExp(name + ' Coming soon') });
    expect(button).toBeDisabled(); fireEvent.click(button);
  }
  expect(modal.getByText(/availability is not verified/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('resets page two to one, preserves loading/error/retry behavior, then shows a genuine empty state', async () => {
  await start();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...page, items: page.items.slice(0, 2), page: 2 })));
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText(/Showing 11–12 of 12/);
  let resolve!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  const modal = open(); edit(modal, 'City', 'No match'); fireEvent.click(modal.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getByText('Searching homes…')).toBeInTheDocument();
  expect(fetchMock.mock.lastCall?.[0]).toBe('/api/listings?city=No+match&page=1&pageSize=10');
  await act(async () => resolve(new Response(null, { status: 503 })));
  await screen.findByText(/Search is unavailable/);
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(empty)));
  fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
  await screen.findByText(/No homes match/);
  expect(fetchMock.mock.lastCall?.[0]).toBe('/api/listings?city=No+match&page=1&pageSize=10');
  expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
});

it('updates decorative imagery with the authoritative theme without mutating the supplied draft', () => {
  const initialDraft = Object.freeze({ ...emptyFilters, city: 'Original' });
  const props = { initialDraft, pageSize: 10, opener: null, onDismiss: vi.fn(), onApply: vi.fn() };
  const { container, rerender } = render(<AdvancedFilterDialog {...props} theme="light" />);
  expect(container.querySelector('img')).toHaveAttribute('src', expect.stringContaining('haven-filters-panel-day'));
  edit(within(screen.getByRole('dialog')), 'City', 'Local');
  rerender(<AdvancedFilterDialog {...props} theme="dark" />);
  expect(container.querySelector('img')).toHaveAttribute('src', expect.stringContaining('haven-filters-panel-night'));
  expect(screen.getByLabelText('City')).toHaveValue('Local');
  expect(initialDraft.city).toBe('Original');
});

it('wraps keyboard boundaries between Close and Apply without sending a request', async () => {
  await start(); const modal = open();
  const close = modal.getByRole('button', { name: 'Close' });
  const apply = modal.getByRole('button', { name: 'Apply filters' });
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(apply).toHaveFocus();
  fireEvent.keyDown(apply, { key: 'Tab' });
  expect(close).toHaveFocus();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
