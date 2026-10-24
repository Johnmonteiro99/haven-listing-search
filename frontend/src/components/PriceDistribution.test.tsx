import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import samples from '../../../data/sample_listings.json';
import { SearchPanel } from './SearchPanel';
import { PriceHistogram } from './PriceHistogram';
import { buildPriceHistogram } from '../search/priceHistogram';
import { PriceRange } from './PriceRange';
import { emptyFilters } from '../search/filters';

const records = samples.map(item => ({ ...item, relevanceScore: 50 }));
function transport() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const items = params.get('city') === 'Boston' ? [] : params.get('city') ? records.slice(0, 4) : records;
    const page = Number(params.get('page'));
    return Promise.resolve(new Response(JSON.stringify({ items: items.slice((page - 1) * 10, page * 10), page, pageSize: 10, totalCount: items.length, totalPages: Math.ceil(items.length / 10) })));
  });
  vi.stubGlobal('fetch', fetchMock); return fetchMock;
}
afterEach(() => vi.useRealTimers());
async function load() { await act(async () => { await vi.advanceTimersByTimeAsync(300); }); }

it('loads all pages for the panel without replacing main results, and cancellation preserves unsent city edits', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  const fetchMock = transport(); render(<SearchPanel />);
  await screen.findByText('12 homes match your search.');
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } });
  vi.useFakeTimers(); fireEvent.click(screen.getByRole('button', { name: /More filters/ }));
  const modal = within(screen.getByRole('dialog')); await load();
  expect(modal.getByText(/4 listing records/)).toBeVisible();
  expect(screen.getByText('12 homes match your search.')).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(10);
  fireEvent.change(modal.getByLabelText('City'), { target: { value: '' } }); await load();
  expect(modal.getByText(/12 listing records/)).toBeVisible();
  const bars = document.querySelectorAll('.price-histogram-bars span');
  expect(bars).toHaveLength(20);
  expect([...bars].reduce((sum, bar) => sum + Number((bar as HTMLElement).dataset.count), 0)).toBe(12);
  const calls = fetchMock.mock.calls.length;
  fireEvent.change(modal.getByLabelText('Minimum price'), { target: { value: '500000' } });
  fireEvent.change(modal.getByLabelText('Maximum price'), { target: { value: '600000' } }); await load();
  expect(fetchMock).toHaveBeenCalledTimes(calls);
  expect(document.querySelectorAll('.price-histogram-bars span[data-selected="false"]')).not.toHaveLength(0);
  fireEvent.change(modal.getByLabelText('City'), { target: { value: 'Boston' } }); await load();
  expect(modal.getByText('No price data available for this search.')).toBeVisible();
  fireEvent.click(modal.getByRole('button', { name: 'Close' }));
  expect(screen.getByLabelText('City')).toHaveValue('Springfield');
  expect(screen.getByText('12 homes match your search.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /More filters/ })).toHaveFocus();
});

it('retains omitted endpoint semantics and differentiates the two native keyboard controls', () => {
  const onChange = vi.fn();
  render(<PriceRange prefix="test" draft={{ ...emptyFilters }} errors={{}} inline onChange={onChange} />);
  const minimum = screen.getByRole('slider', { name: 'Minimum price slider' });
  const maximum = screen.getByRole('slider', { name: 'Maximum price slider' });
  expect(minimum).toHaveValue('0'); expect(maximum).toHaveValue('2000000');
  expect(minimum).toHaveAttribute('aria-valuetext', 'No limit'); expect(maximum).toHaveAttribute('aria-valuetext', 'No limit');
  expect(screen.getByLabelText('Minimum price')).toHaveValue(''); expect(screen.getByLabelText('Maximum price')).toHaveValue('');
  expect(onChange).not.toHaveBeenCalled();
});


it('updates selection without replacing bars or changing counts, and exposes exact overlap as text', () => {
  const prices = [350000, 450000, 450000, 650000];
  const { bins } = buildPriceHistogram(prices);
  const props = { state: { status: 'ready' as const, prices }, bins, minimum: 0, maximum: 2000000, onRetry: vi.fn(), children: <span>Range controls</span> };
  const { container, rerender } = render(<PriceHistogram {...props} />);
  const bars = [...container.querySelectorAll('.price-histogram-bars span')];
  const heights = bars.map(bar => (bar as HTMLElement).style.height);
  const counts = bars.map(bar => bar.getAttribute('data-count'));
  rerender(<PriceHistogram {...props} minimum={400000} maximum={500000} />);
  expect([...container.querySelectorAll('.price-histogram-bars span')]).toEqual(bars);
  expect(bars.map(bar => (bar as HTMLElement).style.height)).toEqual(heights);
  expect(bars.map(bar => bar.getAttribute('data-count'))).toEqual(counts);
  expect(bars[3]).toHaveAttribute('data-selected', 'false');
  expect(bars[4]).toHaveAttribute('data-selected', 'true');
  const countsDisclosure = container.querySelector('details')!;
  fireEvent.click(screen.getByText('Price distribution counts'));
  expect(countsDisclosure).toHaveAttribute('open');
  expect(within(countsDisclosure).getByText('$400,000 to $500,000, upper limit excluded: 2 records · overlaps selected range')).toBeVisible();
  expect(within(countsDisclosure).getAllByRole('listitem')).toHaveLength(20);
  rerender(<PriceHistogram {...props} minimum={700000} maximum={300000} />);
  expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
  expect(countsDisclosure).toHaveAttribute('open');
  expect(prices).toEqual([350000, 450000, 450000, 650000]);
});
