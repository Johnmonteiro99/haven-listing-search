import { StrictMode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import samples from '../../../data/sample_listings.json';
import type { Listing, SearchResponse } from '../api/listings';
import { getListingImage } from '../assets/listingImage';
import { SearchResults } from './SearchResults';
import App from '../App';

const listing: Listing = Object.freeze({ ...samples[0], status: 'active', relevanceScore: 87.94666666666667 });
const otherFeed: Listing = { ...listing, source: 'MLS_B', description: 'A separate feed record.' };
const data: SearchResponse = { items: [listing, otherFeed], totalCount: 2, page: 1, pageSize: 10, totalPages: 1 };
const callbacks = { onPage: vi.fn(), onClear: vi.fn(), onRetry: vi.fn() };

beforeEach(() => {
  // Model only lifecycle here; real browser checks verify native modality and keys.
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
function start(targetBudget?: number) {
  render(<StrictMode><SearchResults view="grid" onViewChange={() => {}} request={{ status: 'success', data }} targetBudget={targetBudget} {...callbacks} /></StrictMode>);
  const opener = screen.getByRole('button', { name: 'View details for 123 Main St, Apt 4B (MLS_A, A1)' });
  opener.focus(); fireEvent.click(opener);
  return opener;
}

it('opens actual record fields without mutating API data or illustration identity', () => {
  const before = JSON.stringify(data); start();
  const dialog = screen.getByRole('dialog', { name: listing.address });
  const content = within(dialog);
  for (const value of ['$450,000', listing.address, 'Springfield, VA 22150', listing.description, 'MLS_A', 'A1', 'August 29, 2026', '87.9']) {
    expect(content.getByText(value)).toBeInTheDocument();
  }
  for (const [label, value] of [['Bedrooms', '2'], ['Bathrooms', '1.5'], ['Square feet', '980']]) {
    expect(content.getByText(label).nextElementSibling).toHaveTextContent(value);
  }
  expect(content.getByText('August 29, 2026')).toHaveAttribute('datetime', '2026-08-29');
  expect(content.getByText(/not a photograph/)).toBeVisible();
  expect(dialog.querySelector('img')).toHaveAttribute('src', getListingImage(listing.source, listing.id).large);
  expect(JSON.stringify(data)).toBe(before);
  expect(listing.relevanceScore).toBe(87.94666666666667);
});

it('focuses Close, locks scrolling, closes and restores the exact opener', () => {
  document.body.style.overflow = 'auto';
  const opener = start();
  expect(screen.getByRole('button', { name: 'Close property details' })).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(screen.getByRole('button', { name: 'Close property details' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(document.body.style.overflow).toBe('auto');
  document.body.style.overflow = '';
});

it('handles native Escape cancellation and permits repeated opening', () => {
  const opener = start();
  expect(fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))).toBe(false);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  fireEvent.click(opener);
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('preserves source/id identity when addresses and IDs coincide across feeds', () => {
  render(<SearchResults view="grid" onViewChange={() => {}} request={{ status: 'success', data }} {...callbacks} />);
  fireEvent.click(screen.getByRole('button', { name: /\(MLS_B, A1\)/ }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('MLS_B')).toBeVisible();
  expect(dialog.getByText('A separate feed record.')).toBeVisible();
  expect(dialog.queryByText(listing.description)).not.toBeInTheDocument();
});

it.each([undefined, 500000])('explains only applied scoring factors for budget %s', budget => {
  start(budget);
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText(/Recency decreases linearly over 180 days/)).toBeInTheDocument();
  if (budget === undefined) {
    expect(dialog.getByText('Based on listing recency. Rounded for display.')).toBeVisible();
    expect(dialog.queryByText(/contributes 70%/)).not.toBeInTheDocument();
  } else {
    expect(dialog.getByText(/\$500,000 target budget/)).toBeVisible();
    expect(dialog.getByText(/Budget proximity contributes 70%/)).toBeInTheDocument();
  }
  expect(dialog.getByText('How this score works').tagName).toBe('SUMMARY');
});

it('switches themes and Auto while open without refetching or losing selection and drafts', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(data))));
  vi.stubGlobal('fetch', fetchMock); render(<App />);
  const opener = await screen.findByRole('button', { name: /\(MLS_A, A1\)/ });
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Unsubmitted city' } });
  fireEvent.click(opener);
  const dialog = screen.getByRole('dialog'); const controls = within(dialog);
  fireEvent.click(controls.getByRole('switch'));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByRole('dialog')).toBe(dialog);
  fireEvent.click(controls.getByRole('switch'));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  fireEvent.click(controls.getByRole('button', { name: 'Auto: use system appearance' }));
  expect(controls.getByRole('button', { name: 'Auto: use system appearance' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(controls.getByRole('button', { name: 'Close property details' }));
  expect(opener).toHaveFocus();
  expect(screen.getByLabelText('City')).toHaveValue('Unsubmitted city');
  expect(screen.getByText(/Page 1 of 1/)).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('restores scrolling on unmount and has no semantic accessibility violations', async () => {
  const { unmount } = render(<SearchResults view="grid" onViewChange={() => {}} request={{ status: 'success', data }} {...callbacks} />);
  fireEvent.click(screen.getByRole('button', { name: /\(MLS_A, A1\)/ }));
  const result = await axe.run(screen.getByRole('dialog'), {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, rules: { 'color-contrast': { enabled: false } },
  });
  expect(result.violations).toEqual([]);
  unmount(); expect(document.body.style.overflow).toBe('');
});
