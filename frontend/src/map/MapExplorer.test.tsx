import { useState, type ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode, Ref } from 'react';
import type { DivIcon, LatLngBounds } from 'leaflet';
import samples from '../../../data/sample_listings.json';
import type { Listing, SearchResponse } from '../api/listings';
import { SearchResults as ControlledSearchResults } from '../components/SearchResults';
import App from '../App';
import { MapBoundary } from './MapBoundary';
import { ListingCard } from '../components/ListingCard';

const mocks = vi.hoisted(() => ({
  zoom: 10, zoomIn: vi.fn(), zoomOut: vi.fn(), on: vi.fn(), off: vi.fn(),
  fitBounds: vi.fn(), invalidateSize: vi.fn(), panTo: vi.fn(), closePopup: vi.fn(),
  contains: vi.fn(() => true), disconnect: vi.fn(), observe: vi.fn(),
  tileEvents: {} as Record<string, () => void>,
  resize: null as null | (() => void),
}));

// Test React coordination and map contracts, not network tiles or jsdom geography/layout.
vi.mock('react-leaflet', async () => {
  const React = await import('react');
  const map = {
    getZoom: () => mocks.zoom, getMaxZoom: () => 19, getMinZoom: () => 2, zoomIn: mocks.zoomIn, zoomOut: mocks.zoomOut, on: mocks.on, off: mocks.off,
    fitBounds: mocks.fitBounds, invalidateSize: mocks.invalidateSize, panTo: mocks.panTo,
    closePopup: mocks.closePopup, getBounds: () => ({ contains: mocks.contains }),
    getContainer: () => document.querySelector('[data-testid="leaflet-container"]')!,
  };
  function MapContainer({ children, ref }: { children: ReactNode; ref: Ref<typeof map> }) {
    React.useImperativeHandle(ref, () => map, []);
    return <div data-testid="leaflet-container">{children}</div>;
  }
  function Marker({ children, position, title, eventHandlers, ref, icon }: {
    children: ReactNode; position: number[]; title: string; icon: DivIcon;
    ref: Ref<{ getElement: () => HTMLButtonElement | null }>;
    eventHandlers: { click: () => void };
  }) {
    const element = React.useRef<HTMLButtonElement>(null);
    const [open, setOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({ getElement: () => element.current }), []);
    return <div><button ref={element} title={title} data-lat={position[0]} data-lng={position[1]}
      data-selected={icon.options.className?.includes('is-selected')}
      onClick={() => { setOpen(value => !value); eventHandlers.click(); }}>{title}</button>{open && children}</div>;
  }
  function TileLayer({ eventHandlers }: { eventHandlers: Record<string, () => void> }) {
    mocks.tileEvents = eventHandlers;
    return <div data-testid="tile-layer" />;
  }
  return { MapContainer, Marker, TileLayer, useMap: () => map, Tooltip: () => null, Popup: ({ children }: { children: ReactNode }) => <div>{children}</div> };
});

const listings: Listing[] = samples.map(item => ({ ...item, status: item.status as Listing['status'], relevanceScore: 87.94666666666667 }));
const data: SearchResponse = { items: listings.slice(0, 10), totalCount: 12, page: 1, pageSize: 10, totalPages: 2 };
const request = { status: 'success' as const, data };
const callbacks = { onPage: vi.fn(), onClear: vi.fn(), onRetry: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.zoom = 10;
  mocks.contains.mockReturnValue(true);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { mocks.resize = callback; }
    observe = mocks.observe;
    disconnect = mocks.disconnect;
  });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
async function openMap() {
  fireEvent.click(screen.getByRole('button', { name: 'Map' }));
  await screen.findByTestId('leaflet-container');
}
function start() { return render(<SearchResults request={request} {...callbacks} />); }

it('keeps Grid as default without initializing Leaflet, then restores the same ranked grid', async () => {
  const { container } = start();
  expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByTestId('tile-layer')).not.toBeInTheDocument();
  expect(container.querySelectorAll('.listing-card-compact')).toHaveLength(0);
  const addresses = screen.getAllByRole('article').map(article => within(article).getByRole('heading').textContent);
  await openMap();
  expect(screen.getByRole('complementary', { name: 'Property map' })).toBeVisible();
  expect(screen.getByText('Showing 10 of 12 matching properties.')).toBeVisible();
  expect(container.querySelectorAll('.listing-card-compact')).toHaveLength(10);
  fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
  expect(screen.queryByTestId('leaflet-container')).not.toBeInTheDocument();
  expect(screen.getAllByRole('article').map(article => within(article).getByRole('heading').textContent)).toEqual(addresses);
  expect(mocks.disconnect).toHaveBeenCalled();
});

it('creates markers at real coordinates, fits the page, and offers each co-located source record', async () => {
  start(); await openMap();
  const marker = screen.getByRole('button', { name: /2 listings at 123 Main St/ });
  expect(marker).toHaveAttribute('data-lat', '38.7893');
  expect(marker).toHaveAttribute('data-lng', '-77.1873');
  const bounds = mocks.fitBounds.mock.calls[0][0] as LatLngBounds;
  expect(bounds.contains([38.7893, -77.1873])).toBe(true);
  fireEvent.click(marker);
  const chooser = within(screen.getByRole('group', { name: 'Choose a listing at this location' }));
  expect(chooser.getAllByRole('button')).toHaveLength(2);
  fireEvent.click(chooser.getByRole('button', { name: /MLS_B \/ B7/ }));
  const featured = screen.getByRole('region', { name: 'Selected property' });
  expect(within(featured).getByRole('heading', { name: listings[1].address })).toBeInTheDocument();
  expect(within(featured).getByText(listings[1].description)).toBeInTheDocument();
  expect(within(featured).getByText('MLS source: MLS_B / Listing ID: B7')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Selected.*2 listings at 123 Main St/ })).toHaveAttribute('data-selected', 'true');
  expect(mocks.closePopup).toHaveBeenCalled();
});

it('coordinates compact cards, featured fields, other homes, close selection, and focus', async () => {
  start(); await openMap();
  fireEvent.click(screen.getByRole('button', { name: /Select.*\(MLS_A, A1\) on map/ }));
  expect(screen.getByRole('heading', { name: 'Selected property' })).toHaveFocus();
  const featured = within(screen.getByRole('region', { name: 'Selected property' }));
  for (const value of ['$450,000', 'Springfield, VA 22150', '1.5 bathrooms', '980 sq ft', listings[0].description, '87.9 / 100']) expect(featured.getByText(value)).toBeVisible();
  expect(within(screen.getByRole('list', { name: 'Other matching homes' })).getAllByRole('article')).toHaveLength(9);
  expect(within(screen.getByRole('list', { name: 'Other matching homes' })).queryByRole('button', { name: /\(MLS_A, A1\)/ })).not.toBeInTheDocument();
  fireEvent.click(featured.getByRole('button', { name: /View details/ }));
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Close property details' }));
  expect(featured.getByRole('button', { name: /View details/ })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: /Close selection/ }));
  expect(screen.queryByRole('region', { name: 'Selected property' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Select.*\(MLS_A, A1\) on map/ })).toHaveFocus();
  expect(screen.getAllByRole('article')).toHaveLength(10);
  expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
});

it('selects single markers and distinguishes IDs repeated in another feed', async () => {
  const other = { ...listings[0], source: 'MLS_B', latitude: 38.9, description: 'Separate feed identity.' };
  render(<SearchResults request={{ status: 'success', data: { ...data, items: [listings[0], other] } }} {...callbacks} />);
  await openMap();
  fireEvent.click(screen.getByRole('button', { name: /\$450,000.*MLS_B, A1/ }));
  expect(within(screen.getByRole('region', { name: 'Selected property' })).getByText('Separate feed identity.')).toBeVisible();
  expect(within(screen.getByRole('list', { name: 'Other matching homes' })).getByRole('button', { name: /\(MLS_A, A1\)/ })).toBeVisible();
});

it('clears selection for loading and the next page while preserving Map mode', async () => {
  const { rerender } = start(); await openMap();
  fireEvent.click(screen.getByRole('button', { name: /Select.*\(MLS_A, A1\)/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(callbacks.onPage).toHaveBeenCalledWith(2);
  rerender(<SearchResults request={{ status: 'searching' }} {...callbacks} />);
  expect(screen.queryByRole('region', { name: 'Selected property' })).not.toBeInTheDocument();
  rerender(<SearchResults request={{ status: 'success', data: { ...data, page: 2, items: listings.slice(10) } }} {...callbacks} />);
  await screen.findByTestId('leaflet-container');
  expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getAllByRole('article')).toHaveLength(2);
});

it('preserves map selection through theme switches and clears it on submitted filters without extra requests', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(data))));
  vi.stubGlobal('fetch', fetchMock); render(<App />);
  await screen.findByRole('article', { name: listings[0].address });
  await openMap();
  fireEvent.click(screen.getByRole('button', { name: /Select.*\(MLS_A, A1\)/ }));
  const count = fetchMock.mock.calls.length;
  const fits = mocks.fitBounds.mock.calls.length;
  fireEvent.click(screen.getByRole('switch'));
  expect(screen.getByRole('region', { name: 'Selected property' })).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(count);
  expect(mocks.fitBounds).toHaveBeenCalledTimes(fits);
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Search homes' }));
  await screen.findByTestId('leaflet-container');
  expect(screen.queryByRole('region', { name: 'Selected property' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  expect(fetchMock).toHaveBeenCalledTimes(count + 1);
});

it('keeps cards and Grid available on tile failure and cleans resize observers on unmount', async () => {
  const { unmount } = start(); await openMap();
  fireEvent.click(screen.getByRole('button', { name: 'Fit visible listings' }));
  expect(mocks.fitBounds.mock.calls.length).toBeGreaterThan(1);
  // Callback comes from the real map component, with only the tile transport mocked.
  const { act } = await import('@testing-library/react');
  act(() => mocks.tileEvents.tileerror());
  act(() => mocks.tileEvents.tileerror());
  expect(screen.getByText(/Some map tiles could not load/)).toBeVisible();
  expect(screen.getAllByRole('article')).toHaveLength(10);
  expect(screen.getByRole('button', { name: 'Grid' })).toBeEnabled();
  unmount(); expect(mocks.disconnect).toHaveBeenCalled();
});

it('initializes with reduced motion without starting a different search or animated map movement', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  start(); await openMap();
  expect(mocks.fitBounds.mock.calls[0][1]).toMatchObject({ animate: false });
  expect(mocks.observe).toHaveBeenCalled();
});


it('invalidates Leaflet after container resizing and cancels pending resize work on cleanup', async () => {
  const cancel = vi.spyOn(window, 'cancelAnimationFrame');
  const clear = vi.spyOn(window, 'clearTimeout');
  const { unmount } = start(); await openMap();
  const before = mocks.invalidateSize.mock.calls.length;
  mocks.resize?.();
  await waitFor(() => expect(mocks.invalidateSize.mock.calls.length).toBeGreaterThan(before));
  unmount();
  expect(mocks.disconnect).toHaveBeenCalled();
  expect(cancel).toHaveBeenCalled();
  expect(clear).toHaveBeenCalled();
});


it('keeps Map mode through empty and failed searches without initializing blank-result tiles', async () => {
  const { rerender } = start(); await openMap();
  rerender(<SearchResults request={{ status: 'success', data: { ...data, items: [], totalCount: 0, totalPages: 0 } }} {...callbacks} />);
  expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('There are no locations on this result page.')).toBeVisible();
  expect(screen.queryByTestId('tile-layer')).not.toBeInTheDocument();
  rerender(<SearchResults request={{ status: 'error', message: 'Search unavailable.', validation: false }} {...callbacks} />);
  expect(screen.getByRole('button', { name: 'Retry search' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Grid' })).toBeEnabled();
});

it('shows a useful map failure boundary without removing listing cards', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function BrokenMap(): ReactNode { throw new Error('Simulated map import failure'); }
  render(<div><ListingCard listing={listings[0]} /><MapBoundary><BrokenMap /></MapBoundary></div>);
  expect(screen.getByText('The map is unavailable.')).toBeVisible();
  expect(screen.getByRole('article', { name: listings[0].address })).toBeVisible();
});

it('reports stalled tiles without treating successfully loaded tiles as a timeout', async () => {
  const { default: ListingMap } = await import('./ListingMap');
  const { act } = await import('@testing-library/react');
  vi.useFakeTimers();
  try {
    const { unmount } = render(<ListingMap listings={listings} selectedKey={null} onSelect={vi.fn()} />);
    expect(screen.getByText('Loading map tiles…')).toBeVisible();
    act(() => vi.advanceTimersByTime(10000));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText(/Some map tiles could not load/)).toBeVisible();
    unmount();
    const second = render(<ListingMap listings={listings} selectedKey={null} onSelect={vi.fn()} />);
    act(() => mocks.tileEvents.tileload());
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.queryByText(/Some map tiles could not load/)).not.toBeInTheDocument();
    expect(screen.getByText(/8 mapped locations/)).toBeVisible();
    second.unmount();
  } finally { vi.useRealTimers(); }
});

it('uses the same featured experience for cards and markers without moving the map or fetching', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(data))));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByRole('article', { name: listings[0].address });
  await openMap();
  // Even an off-screen property's selection must preserve the user's chosen camera.
  mocks.contains.mockReturnValue(false);
  const requestCount = fetchMock.mock.calls.length;
  const mapContainer = screen.getByTestId('leaflet-container');
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Unsubmitted city' } });
  fireEvent.click(screen.getByRole('button', { name: /Select.*\(MLS_A, A1\) on map/ }));
  const firstFeatured = within(screen.getByRole('region', { name: 'Selected property' })).getByRole('article').textContent;
  expect(screen.getByText('Selected 123 Main St, Apt 4B, MLS_A / A1.')).toHaveAttribute('role', 'status');
  expect(screen.getByRole('button', { name: /Selected.*2 listings at 123 Main St/ })).toHaveAttribute('data-selected', 'true');
  fireEvent.click(screen.getByRole('button', { name: /Close selection/ }));
  expect(screen.getByRole('button', { name: /Select.*\(MLS_A, A1\) on map/ })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: /2 listings at 123 Main St/ }));
  const choices = within(screen.getByRole('group', { name: 'Choose a listing at this location' }));
  fireEvent.click(choices.getByRole('button', { name: /MLS_A \/ A1/ }));
  expect(within(screen.getByRole('region', { name: 'Selected property' })).getByRole('article').textContent).toBe(firstFeatured);
  fireEvent.click(screen.getByRole('button', { name: /Select.*\(MLS_B, B7\) on map/ }));
  expect(within(screen.getByRole('region', { name: 'Selected property' })).getByText(listings[1].description)).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Selected property' })).toHaveFocus();
  expect(screen.getByText('Selected 123 Main Street, Unit 4B, MLS_B / B7.')).toHaveAttribute('role', 'status');
  expect(within(screen.getByRole('list', { name: 'Other matching homes' })).getAllByRole('article')).toHaveLength(9);
  expect(screen.getByTestId('leaflet-container')).toBe(mapContainer);
  expect(mocks.panTo).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(requestCount);
  expect(screen.getByLabelText('City')).toHaveValue('Unsubmitted city');
});

it('applies advanced criteria in Map mode, clears the featured selection and replaces current-page markers', async () => {
  const filtered = { items: [listings[5]], totalCount: 1, totalPages: 1, page: 1, pageSize: 10 };
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(
    url.includes('/api/health') ? { status: 'ok' } : url.includes('keyword=') ? filtered : data,
  ))));
  vi.stubGlobal('fetch', fetchMock); render(<App />);
  await screen.findByText('12 homes match your search.'); await openMap();
  fireEvent.click(screen.getAllByRole('button', { name: /Select .* on map/ })[0]);
  expect(screen.getByText('Selected property')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /More filters/ }));
  const modal = within(screen.getByRole('dialog', { name: 'Filters' }));
  fireEvent.change(modal.getByLabelText('Description keyword'), { target: { value: 'filtered' } });
  const before = fetchMock.mock.calls.length;
  fireEvent.click(modal.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText('1 home matches your search.');
  await screen.findByTestId('leaflet-container');
  expect(fetchMock).toHaveBeenCalledTimes(before + 1);
  expect(fetchMock.mock.lastCall?.[0]).toBe('/api/listings?keyword=filtered&page=1&pageSize=10');
  expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByText('Selected property')).not.toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(1);
  const markers = document.querySelectorAll('[data-lat]');
  expect(markers).toHaveLength(1);
  expect(markers[0]).toHaveAttribute('data-lat', String(listings[5].latitude));
});

it('connects circular controls to Leaflet zoom and fit, with real zoom-limit disabled states', async () => {
  start(); await openMap();
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
  expect(mocks.zoomIn).toHaveBeenCalledTimes(1);
  expect(mocks.zoomOut).toHaveBeenCalledTimes(1);
  const before = mocks.fitBounds.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Fit visible listings' }));
  expect(mocks.fitBounds).toHaveBeenCalledTimes(before + 1);
  const { act } = await import('@testing-library/react');
  const update = mocks.on.mock.calls.find(call => call[0] === 'zoomend')![1] as () => void;
  act(() => { mocks.zoom = 19; update(); });
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  act(() => { mocks.zoom = 2; update(); });
  expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
});


it('fits within the map column without reserving space for the adjacent results', async () => {
  start(); await openMap();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(min-width: 1200px)', addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  fireEvent.click(screen.getByRole('button', { name: 'Fit visible listings' }));
  expect(mocks.fitBounds.mock.lastCall?.[1]).toMatchObject({ paddingTopLeft: [48, 48], paddingBottomRight: [80, 64], animate: false });
});

/** Standalone results tests supply the same controlled view contract as SearchPanel. */
function SearchResults(props: Omit<ComponentProps<typeof ControlledSearchResults>, 'view' | 'onViewChange'>) {
  const [view, setView] = useState<'grid' | 'map'>('grid');
  return <ControlledSearchResults {...props} view={view} onViewChange={setView} />;
}
