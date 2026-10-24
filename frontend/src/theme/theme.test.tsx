import { act, fireEvent, render, screen } from '@testing-library/react';
import bootstrap from '../../public/theme-init.js?raw';
import { expect, it, vi } from 'vitest';
import App from '../App';
import axe from 'axe-core';

function prepareSystemTheme(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: dark,
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media));
  return {
    media,
    change: (next: boolean) => act(() => {
      media.matches = next;
      listeners.forEach((listener) => listener());
    }),
  };
}

function renderShell() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(
    url === '/api/health' ? { status: 'ok' } : { items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 },
  )))));
  return render(<App />);
}

it('renders a semantic header, real anchor, and labeled appearance control', () => {
  renderShell();
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Our perspective' })).toHaveAttribute('href', '#perspective');
  expect(screen.getByRole('button', { name: 'Auto: use system appearance' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Extraordinary homes');
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
});

it('respects the initial dark system preference and tracks changes', () => {
  const system = prepareSystemTheme(true);
  renderShell();
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  system.change(false);
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});

it('persists an explicit override across remounts and ignores system changes', () => {
  const system = prepareSystemTheme(false);
  const first = renderShell();
  fireEvent.click(screen.getByRole('switch', { name: 'Dark appearance' }));
  expect(localStorage.getItem('haven-theme')).toBe('dark');
  system.change(true);
  system.change(false);
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  first.unmount();
  renderShell();
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

it('returns to current system preference when the user chooses System', () => {
  const system = prepareSystemTheme(false);
  localStorage.setItem('haven-theme', 'light');
  renderShell();
  system.change(true);
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  fireEvent.click(screen.getByRole('button', { name: 'Auto: use system appearance' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem('haven-theme')).toBe('system');
});

it('keeps theme control functional if storage is blocked', () => {
  vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  renderShell();
  fireEvent.click(screen.getByRole('switch', { name: 'Dark appearance' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

it('treats an invalid stored preference as System', () => {
  localStorage.setItem('haven-theme', 'invalid');
  prepareSystemTheme(true);
  renderShell();
  expect(screen.getByRole('button', { name: 'Auto: use system appearance' })).toHaveAttribute('aria-pressed', 'true');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

it('switches decorative responsive hero imagery without adding alternative facts', () => {
  const { container } = renderShell();
  const hero = container.querySelector('.hero-image');
  expect(hero).toHaveAttribute('alt', '');
  expect(hero).toHaveAttribute('src', '/images/hero/hero-light-1672.webp');
  expect(hero).toHaveAttribute('srcset', expect.stringContaining('hero-light-640.webp 640w'));
  fireEvent.click(screen.getByRole('switch', { name: 'Dark appearance' }));
  expect(container.querySelector('.hero-image')).toBe(hero);
  expect(container.querySelectorAll('.hero-image')).toHaveLength(2);
  expect(container.querySelectorAll('.hero-image')[1]).toHaveAttribute('src', '/images/hero/hero-dark-1672.webp');
  expect(hero).toHaveAttribute('fetchpriority', 'high');
});

it('cleans up the system listener on unmount', () => {
  const system = prepareSystemTheme(false);
  const { unmount } = renderShell();
  unmount();
  expect(system.media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
});

it('applies saved and system palettes before React mounts', () => {
  // Exercise the actual early head script, so initial-paint logic stays aligned.
  prepareSystemTheme(true);
  new Function(bootstrap)();
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  localStorage.setItem('haven-theme', 'light');
  new Function(bootstrap)();
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});

it('has no automated semantic accessibility violations', async () => {
  document.title = 'HAVEN — Listing Search';
  document.documentElement.lang = 'en';
  renderShell();
  await screen.findByText('No homes match your search. Try adjusting your filters.');
  // jsdom has no real layout/color rendering; browser audits cover contrast.
  const results = await axe.run(document.documentElement, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(results.violations).toEqual([]);
});

it('exposes a native keyboard-focusable switch, its state, and the next action in both directions', () => {
  renderShell();
  const toggle = screen.getByRole('switch', { name: 'Dark appearance' });
  expect(toggle.tagName).toBe('BUTTON');
  toggle.focus();
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(toggle).toHaveAccessibleDescription('Switch to dark appearance.');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(toggle).toHaveAccessibleDescription('Switch to light appearance.');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(localStorage.getItem('haven-theme')).toBe('light');
});
