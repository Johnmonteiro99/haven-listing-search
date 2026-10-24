import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MapTiles, mapTileSource } from './MapTiles';

const transport = vi.hoisted(() => ({ events: {} as Record<string, () => void> }));
vi.mock('react-leaflet', () => ({ TileLayer: ({ url, attribution, eventHandlers }: { url: string; attribution: string; eventHandlers: Record<string, () => void> }) => {
  transport.events = eventHandlers;
  return <div data-testid="tiles" data-url={url} data-attribution={attribution} />;
} }));

it('uses approved light/dark raster sources only on documented keyless development hosts', () => {
  for (const host of ['localhost', '127.0.0.1']) {
    expect(mapTileSource('light', host).url).toContain('/alidade_smooth/');
    expect(mapTileSource('dark', host).url).toContain('/alidade_smooth_dark/');
  }
  for (const host of ['example.com', '192.168.1.2', 'localhost.example.com']) {
    expect(mapTileSource('dark', host).url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  }
  expect(mapTileSource('dark', 'localhost').attribution).toMatch(/Stadia Maps.*OpenMapTiles.*OpenStreetMap/);
});

it('updates the themed layer then falls back once, preserving a useful failure state', () => {
  const status = vi.fn();
  const { rerender } = render(<MapTiles theme="light" onStatus={status} />);
  expect(screen.getByTestId('tiles')).toHaveAttribute('data-url', expect.stringContaining('/alidade_smooth/'));
  rerender(<MapTiles theme="dark" onStatus={status} />);
  expect(screen.getByTestId('tiles')).toHaveAttribute('data-url', expect.stringContaining('/alidade_smooth_dark/'));
  act(() => transport.events.tileerror());
  expect(screen.getByTestId('tiles')).toHaveAttribute('data-url', expect.stringContaining('tile.openstreetmap.org'));
  expect(screen.getByTestId('tiles')).toHaveAttribute('data-attribution', expect.not.stringContaining('Stadia'));
  act(() => transport.events.tileload());
  expect(status).toHaveBeenLastCalledWith(expect.stringContaining('Standard map fallback'));
  act(() => transport.events.tileerror());
  expect(status).toHaveBeenLastCalledWith(expect.stringContaining('Some map tiles could not load'));
  act(() => transport.events.tileload());
  expect(status).toHaveBeenLastCalledWith(expect.stringContaining('Some map tiles could not load'));
});
