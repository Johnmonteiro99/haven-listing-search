import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { SearchPanel } from './SearchPanel';

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
    items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0,
  }))));
  vi.stubGlobal('fetch', fetchMock);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
async function start() { render(<SearchPanel />); await screen.findByText(/No homes match/); }
function openPrice() { fireEvent.click(screen.getByRole('button', { name: /Price range Any price/ })); }
function edit(name: string, value: string) { fireEvent.change(screen.getByLabelText(name), { target: { value } }); }
function submit() { fireEvent.submit(screen.getByRole('form', { name: 'Search homes' })); }

it('synchronizes both sliders and precise numeric drafts without fetching on edit', async () => {
  await start(); openPrice();
  fireEvent.change(screen.getByRole('slider', { name: 'Minimum price slider' }), { target: { value: '400000' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Maximum price slider' }), { target: { value: '600000' } });
  expect(screen.getByLabelText('Minimum price')).toHaveValue('400000');
  expect(screen.getByLabelText('Maximum price')).toHaveValue('600000');
  edit('Minimum price', '450000');
  expect(screen.getByRole('slider', { name: 'Minimum price slider' })).toHaveValue('450000');
  expect(screen.getByRole('slider', { name: 'Minimum price slider' })).toHaveAttribute('aria-valuetext', '$450,000');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('keeps prices above the visual slider limit and decimal precision in the API query', async () => {
  await start(); openPrice(); edit('Minimum price', '2500000.25'); edit('Maximum price', '4000000.75');
  expect(screen.getByRole('slider', { name: 'Minimum price slider' })).toHaveValue('2000000');
  expect(screen.getByRole('slider', { name: 'Maximum price slider' })).toHaveAttribute('aria-valuetext', expect.stringContaining('above slider range'));
  submit(); await screen.findByText(/No homes match/);
  expect(fetchMock.mock.calls[1][0]).toContain('minPrice=2500000.25&maxPrice=4000000.75');
  expect(screen.getByLabelText('Minimum price')).toHaveValue('2500000.25');
});

it.each([['Minimum price', '-1'], ['Maximum price', 'not a number'], ['Minimum price', '750000>']])('rejects invalid %s drafts without silently clamping', async (label, value) => {
  await start(); openPrice(); edit(label, value); submit();
  expect(screen.getByRole('alert')).toHaveFocus();
  expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText(label)).toHaveValue(value);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each(['Minimum', 'Maximum'])('keeps the popover open through Safari blur during a %s thumb gesture, then releases it', async handle => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  await start(); openPrice();
  const slider = screen.getByRole('slider', { name: `${handle} price slider` });
  const opener = screen.getByRole('button', { name: /Price range/ });
  fireEvent.pointerDown(slider, { button: 0, buttons: 1 });
  // Safari sends focus to an ancestor instead of the range input on a thumb press.
  fireEvent.blur(screen.getByLabelText('Minimum price'), { relatedTarget: document.body });
  expect(opener).toHaveAttribute('aria-expanded', 'true');
  fireEvent.change(slider, { target: { value: '500000' } });
  expect(screen.getByLabelText(`${handle} price`)).toHaveValue('500000');
  fireEvent.pointerUp(document.body, { button: 0, buttons: 0 });
  expect(slider).toHaveFocus();
  // Release must clear the suppression so ordinary keyboard focus departure closes.
  fireEvent.blur(slider, { relatedTarget: screen.getByLabelText('City') });
  expect(opener).toHaveAttribute('aria-expanded', 'false');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('cleans up a cancelled thumb gesture and closes on window blur', async () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  await start(); openPrice();
  const slider = screen.getByRole('slider', { name: 'Minimum price slider' });
  fireEvent.pointerDown(slider, { button: 0, buttons: 1 });
  fireEvent.pointerCancel(document.body);
  expect(slider).toHaveFocus();
  fireEvent.blur(slider, { relatedTarget: screen.getByLabelText('City') });
  expect(screen.getByRole('button', { name: /Price range/ })).toHaveAttribute('aria-expanded', 'false');
  openPrice();
  fireEvent.pointerDown(slider, { button: 0, buttons: 1 });
  fireEvent.blur(window);
  expect(screen.getByRole('button', { name: /Price range/ })).toHaveAttribute('aria-expanded', 'false');
});

it('prevents crossing slider bounds, validates typed inversions, and clears only the price draft', async () => {
  await start(); edit('City', 'Springfield'); openPrice();
  fireEvent.change(screen.getByRole('slider', { name: 'Minimum price slider' }), { target: { value: '600000' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Maximum price slider' }), { target: { value: '400000' } });
  expect(screen.getByLabelText('Maximum price')).toHaveValue('600000');
  edit('Maximum price', '400000');
  expect(screen.getByLabelText('Maximum price')).toHaveAccessibleDescription('Maximum price must be at least the minimum price.');
  submit(); expect(fetchMock).toHaveBeenCalledTimes(1);
  // Validation focuses the summary and closes the nonmodal popover; reopen to correct it.
  fireEvent.click(screen.getByRole('button', { name: /Price range Check amounts/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear price range' }));
  expect(screen.getByLabelText('Minimum price')).toHaveValue('');
  expect(screen.getByLabelText('Maximum price')).toHaveValue('');
  expect(screen.getByLabelText('City')).toHaveValue('Springfield');
  expect(screen.getByRole('slider', { name: 'Maximum price slider' })).toHaveAttribute('aria-valuetext', 'No limit');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each(['1', '2', '3', '4', '5'])('maps stepped bedroom %s+ to the exact API minimum', async value => {
  await start();
  const group = within(screen.getByRole('group', { name: 'Bedroom minimum controls' }));
  for (let index = 0; index < Number(value); index++) fireEvent.click(group.getByRole('button', { name: 'Increase minimum bedrooms' }));
  expect(screen.getByLabelText('Minimum bedrooms')).toHaveValue(value);
  submit(); await screen.findByText(/No homes match/);
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/listings?minBedrooms=${value}&page=1&pageSize=10`);
  for (let index = 0; index < Number(value); index++) fireEvent.click(group.getByRole('button', { name: 'Decrease minimum bedrooms' }));
  expect(screen.getByLabelText('Minimum bedrooms')).toHaveValue('');
  submit(); await screen.findByText(/No homes match/);
  expect(fetchMock.mock.calls[2][0]).toBe('/api/listings?page=1&pageSize=10');
});

it('focuses the price input, closes on Escape with trigger focus, and allows Tab to leave', async () => {
  await start(); openPrice();
  expect(screen.getByLabelText('Minimum price')).toHaveFocus();
  fireEvent.keyDown(screen.getByLabelText('Minimum price'), { key: 'Escape' });
  expect(screen.getByRole('button', { name: /Price range Any price/ })).toHaveFocus();
  expect(screen.getByRole('button', { name: /Price range Any price/ })).toHaveAttribute('aria-expanded', 'false');
  openPrice();
  // Native Tab traversal is verified in Chrome; blur models leaving this nonmodal group.
  fireEvent.blur(screen.getByLabelText('Minimum price'), { relatedTarget: screen.getByRole('button', { name: 'Increase minimum bedrooms' }) });
  expect(screen.getByRole('button', { name: /Price range Any price/ })).toHaveAttribute('aria-expanded', 'false');
});

it('uses shared price/bedroom controls in disposable mobile drafts and applies once', async () => {
  await start();
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  open(); let modal = within(screen.getByRole('dialog'));
  fireEvent.change(modal.getByRole('slider', { name: 'Maximum price slider' }), { target: { value: '500000' } });
  fireEvent.click(modal.getByRole('button', { name: '2+' }));
  fireEvent.click(modal.getByRole('button', { name: 'Close' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  open(); modal = within(screen.getByRole('dialog'));
  expect(modal.getByLabelText('Maximum price')).toHaveValue('');
  expect(modal.getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(modal.getByRole('slider', { name: 'Maximum price slider' }), { target: { value: '500000' } });
  fireEvent.click(modal.getByRole('button', { name: '2+' }));
  fireEvent.click(modal.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText(/No homes match/);
  expect(fetchMock.mock.calls[1][0]).toBe('/api/listings?maxPrice=500000&minBedrooms=2&page=1&pageSize=10');
  expect(screen.getByRole('button', { name: 'Filters' })).toHaveFocus();
});

it('has no automated semantic accessibility violations with the price control expanded', async () => {
  await start(); openPrice();
  const results = await axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  expect(results.violations).toEqual([]);
});

it('dismisses the price popover on an outside pointer and resets new controls with Clear filters', async () => {
  await start(); openPrice(); edit('Minimum price', '300000');
  fireEvent.pointerDown(screen.getByLabelText('City'));
  expect(screen.getByRole('button', { name: /Price range/ })).toHaveAttribute('aria-expanded', 'false');
  edit('Minimum bedrooms', '5');
  fireEvent.click(within(screen.getByRole('form', { name: 'Search homes' })).getByRole('button', { name: 'Clear filters' }));
  await screen.findByText(/No homes match/);
  expect(screen.getByLabelText('Minimum bedrooms')).toHaveValue('');
  expect(screen.getByRole('button', { name: /Price range Any price/ })).toBeInTheDocument();
  expect(fetchMock.mock.calls[1][0]).toBe('/api/listings?page=1&pageSize=10');
});
