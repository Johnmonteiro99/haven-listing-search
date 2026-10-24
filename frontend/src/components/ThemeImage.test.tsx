import { act, fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ThemeImage } from './ThemeImage';

const sources = {
  light: { src: '/light.webp', srcSet: '/light-small.webp 640w, /light.webp 1024w' },
  dark: { src: '/dark.webp', srcSet: '/dark-small.webp 640w, /dark.webp 1024w' },
};
const props = { sources, sizes: '100vw', width: 1024, height: 576 };

it('requests only the initial scene, then keeps it visible until the alternate decodes', async () => {
  const { container, rerender } = render(<ThemeImage {...props} theme="light" priority />);
  const initial = container.querySelector('img')!;
  expect(container.querySelectorAll('img')).toHaveLength(1);
  expect(initial).toHaveAttribute('fetchpriority', 'high');
  rerender(<ThemeImage {...props} theme="dark" priority />);
  const incoming = container.querySelectorAll('img')[1];
  expect(incoming).toHaveAttribute('fetchpriority', 'auto');
  expect(incoming).toHaveAttribute('data-visible', 'false');
  let decode!: () => void;
  incoming.decode = vi.fn(() => new Promise<void>(resolve => { decode = resolve; }));
  fireEvent.load(incoming);
  expect(initial).toHaveAttribute('data-visible', 'true');
  await act(async () => { decode(); });
  expect(incoming).toHaveAttribute('data-visible', 'true');
  expect(initial).toHaveAttribute('data-visible', 'false');
  expect(container.querySelector('img')).toBe(initial);
});

it('does not let a delayed obsolete decode override a rapid reversal', async () => {
  const { container, rerender } = render(<ThemeImage {...props} theme="light" />);
  rerender(<ThemeImage {...props} theme="dark" />);
  const incoming = container.querySelectorAll('img')[1];
  let decode!: () => void;
  incoming.decode = vi.fn(() => new Promise<void>(resolve => { decode = resolve; }));
  fireEvent.load(incoming);
  rerender(<ThemeImage {...props} theme="light" />);
  await act(async () => { decode(); });
  expect(container.querySelector('[data-visible="true"]')).toHaveAttribute('src', '/light.webp');
  rerender(<ThemeImage {...props} theme="dark" />);
  expect(container.querySelector('[data-visible="true"]')).toHaveAttribute('src', '/dark.webp');
});

it('retains the visible scene if the alternate image fails to load', () => {
  const { container, rerender } = render(<ThemeImage {...props} theme="light" />);
  rerender(<ThemeImage {...props} theme="dark" />);
  fireEvent.error(container.querySelectorAll('img')[1]);
  expect(container.querySelector('[data-visible="true"]')).toHaveAttribute('src', '/light.webp');
});
