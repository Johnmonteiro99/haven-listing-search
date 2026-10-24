import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DelayedLoadingNote } from './DelayedLoadingNote';

afterEach(() => vi.useRealTimers());

it('waits ten seconds, makes no requests, and disappears on completion', () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const { rerender } = render(<DelayedLoadingNote request={{ status: 'loading' }} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(9_999); });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.getByRole('status')).toHaveTextContent('may be waking up');
  expect(fetchMock).not.toHaveBeenCalled();
  rerender(<DelayedLoadingNote request={{ status: 'error', message: 'Try again', validation: false }} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  rerender(<DelayedLoadingNote request={{ status: 'searching' }} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('cleans up the timer on unmount', () => {
  vi.useFakeTimers();
  const { unmount } = render(<DelayedLoadingNote request={{ status: 'searching' }} />);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
