import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SearchPanel } from '../components/SearchPanel';
import App from '../App';
import { buildSearchQuery, getListings, type SearchResponse } from '../api/listings';
import { emptyFilters, validateFilters } from './filters';

const emptyResponse: SearchResponse = { items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 };
function respond(data = emptyResponse) { return new Response(JSON.stringify(data)); }
function edit(label: string, value: string, scope: Pick<typeof screen, 'getByLabelText'> = screen) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}
function submit() { fireEvent.submit(screen.getByRole('form', { name: 'Search homes' })); }

beforeEach(() => {
  // jsdom does not implement top-layer modality; real-browser checks cover focus trapping.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

it('encodes the six supported criteria and pagination, retaining zero and escaping text', () => {
  const query = new URLSearchParams(buildSearchQuery({ minPrice: 0, maxPrice: 500000, minBedrooms: 3, city: ' Springfield ', keyword: 'deck & garden', targetBudget: 450000, page: 2, pageSize: 5 }));
  expect(Object.fromEntries(query)).toEqual({ minPrice: '0', maxPrice: '500000', minBedrooms: '3', city: 'Springfield', keyword: 'deck & garden', targetBudget: '450000', page: '2', pageSize: '5' });
  expect(buildSearchQuery({ city: ' ', page: 1, pageSize: 10 })).toBe('page=1&pageSize=10');
});

it.each([
  ['minPrice', '-1'], ['maxPrice', '-2'], ['minBedrooms', '-1'], ['minBedrooms', '1.5'],
  ['targetBudget', '0'], ['targetBudget', '-1'], ['minPrice', 'Infinity'], ['maxPrice', 'nope'],
] as const)('rejects invalid %s=%s', (key, value) => {
  expect(validateFilters({ ...emptyFilters, [key]: value }).errors[key]).toBeTruthy();
});
it('validates ranges, optional blanks, inclusive zeros and positive integer pages', () => {
  expect(validateFilters({ ...emptyFilters, minPrice: '2', maxPrice: '1' }).errors.maxPrice).toBeTruthy();
  expect(validateFilters({ ...emptyFilters, minPrice: '0', maxPrice: '0', minBedrooms: '0', city: ' ' }).params).toEqual({ page: 1, pageSize: 10, minPrice: 0, maxPrice: 0, minBedrooms: 0 });
  for (const value of [0, -1, 1.5, Infinity]) {
    expect(validateFilters(emptyFilters, value, value).errors).toHaveProperty('page');
    expect(validateFilters(emptyFilters, value, value).errors).toHaveProperty('pageSize');
  }
});

it('loads defaults, submits all six criteria once, and clears to defaults', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(respond()));
  vi.stubGlobal('fetch', fetchMock);
  render(<SearchPanel />);
  expect(screen.getByText('Loading homes…')).toBeInTheDocument();
  await screen.findByText(/No homes match/);
  expect(fetchMock).toHaveBeenCalledWith('/api/listings?page=1&pageSize=10', { signal: expect.any(AbortSignal) });
  edit('City', ' Springfield '); fireEvent.click(screen.getByRole('button', { name: /Price range Any price/ }));
  edit('Minimum price', '400000'); edit('Maximum price', '500000');
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  edit('Minimum bedrooms', '3');
  fireEvent.click(screen.getByText(/More filters/));
  edit('Target budget', '450000'); edit('Description keyword', 'garden');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply filters' }));
  await screen.findByText(/No homes match/);
  expect(fetchMock.mock.calls[1][0]).toBe('/api/listings?minPrice=400000&maxPrice=500000&minBedrooms=3&city=Springfield&keyword=garden&targetBudget=450000&page=1&pageSize=10');
  fireEvent.click(within(screen.getByRole('form', { name: 'Search homes' })).getByRole('button', { name: 'Clear filters' }));
  await screen.findByText(/No homes match/);
  expect(screen.getByLabelText('City')).toHaveValue('');
  expect(fetchMock.mock.calls[2][0]).toBe('/api/listings?page=1&pageSize=10');
});

it('focuses accessible validation feedback and sends no invalid request', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(respond()));
  vi.stubGlobal('fetch', fetchMock); render(<SearchPanel />);
  await screen.findByText(/No homes match/);
  fireEvent.click(screen.getByRole('button', { name: /Price range Any price/ }));
  edit('Minimum price', '500'); edit('Maximum price', '100'); submit();
  expect(screen.getByRole('alert')).toHaveFocus();
  expect(screen.getByLabelText('Maximum price')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Maximum price')).toHaveAccessibleDescription('Maximum price must be at least the minimum price.');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('shows server errors and retries the applied criteria', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockImplementation(() => Promise.resolve(respond()));
  vi.stubGlobal('fetch', fetchMock); render(<SearchPanel />);
  await screen.findByText(/Search is unavailable/);
  edit('City', 'Unsubmitted draft');
  fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
  await screen.findByText(/No homes match/);
  expect(fetchMock.mock.calls[1][0]).toBe('/api/listings?page=1&pageSize=10');
});

it('shows meaningful FastAPI 422 field and range errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ detail: [{ loc: ['query', 'targetBudget'], msg: 'Input should be greater than 0' }] }), { status: 422 }))));
  render(<SearchPanel />);
  expect(await screen.findByText(/targetBudget: Input should be greater than 0/)).toBeInTheDocument();
});

it.each(['malformed', 'network'])('handles %s failures without fake results', async failure => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => failure === 'network' ? Promise.reject(new Error('offline')) : Promise.resolve(new Response('{}'))));
  render(<SearchPanel />);
  expect(await screen.findByText(/Could not complete the search/)).toBeInTheDocument();
});

it('discards mobile edits on dismissal, applies edits, and clears only when applied', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(respond()));
  vi.stubGlobal('fetch', fetchMock); render(<SearchPanel />);
  await screen.findByText(/No homes match/);
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  open(); edit('City', 'Discard me', within(screen.getByRole('dialog')));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('button', { name: 'Filters' })).toHaveFocus();
  expect(screen.getByLabelText('City')).toHaveValue('');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  open();
  const modal = within(screen.getByRole('dialog'));
  edit('City', 'Springfield', modal);
  fireEvent.click(modal.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText(/No homes match/);
  expect(screen.getByLabelText('City')).toHaveValue('Springfield');
  open(); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset all' }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.getByLabelText('City')).toHaveValue('Springfield');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  open(); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset all' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText(/No homes match/);
  expect(fetchMock.mock.calls[2][0]).toBe('/api/listings?page=1&pageSize=10');
});

it('keeps invalid mobile filters open with focused feedback', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(respond())));
  render(<SearchPanel />); await screen.findByText(/No homes match/);
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  edit('Target budget', '0', within(screen.getByRole('dialog')));
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getByRole('alert')).toHaveFocus();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('ignores older responses even if fetch ignores the aborted signal', async () => {
  let resolveOld!: (response: Response) => void;
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; })).mockImplementation(() => Promise.resolve(respond()));
  vi.stubGlobal('fetch', fetchMock); render(<SearchPanel />);
  edit('City', 'No match'); submit();
  expect(screen.getByText('Searching homes…')).toBeInTheDocument();
  await screen.findByText(/No homes match/);
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => { resolveOld(respond({ ...emptyResponse, totalCount: 12, totalPages: 2 })); });
  expect(screen.getByText(/No homes match/)).toBeInTheDocument();
  expect(screen.queryByText(/12 homes/)).not.toBeInTheDocument();
});

it('preserves draft and applied filters when switching theme', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(url === '/api/health' ? new Response('{"status":"ok"}') : respond()));
  vi.stubGlobal('fetch', fetchMock); render(<App />);
  await screen.findByText(/No homes match/);
  edit('City', 'Springfield'); submit(); await screen.findByText(/No homes match/);
  const calls = fetchMock.mock.calls.length;
  fireEvent.click(screen.getByRole('switch', { name: 'Dark appearance' }));
  expect(screen.getByLabelText('City')).toHaveValue('Springfield');
  expect(fetchMock).toHaveBeenCalledTimes(calls);
});

it('rejects invalid listing records at the API boundary', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ...emptyResponse, items: [{ id: 'A1' }] })))));
  await expect(getListings({ page: 1, pageSize: 10 })).rejects.toThrow('Invalid search response');
});
