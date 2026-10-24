import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { EditorialSlideshow } from './EditorialSlideshow';

function setup() {
  const view = render(<EditorialSlideshow />);
  const progress = () => view.container.querySelector('.editorial-progress') as HTMLElement;
  const group = screen.getByRole('group', { name: 'Search features' });
  const next = screen.getByRole('button', { name: 'Next feature' });
  // jsdom does not run CSS animations; browser checks verify the five-second clock.
  const complete = () => fireEvent(progress(), Object.assign(new Event('animationend', { bubbles: true }), {
    animationName: 'editorial-progress',
  }));
  return { ...view, progress, group, next, complete };
}

it('renders one decorative progress bar and Next without segments or playback controls', () => {
  const { container } = setup();
  expect(container.querySelectorAll('.editorial-track')).toHaveLength(1);
  expect(container.querySelector('.editorial-track')).toHaveAttribute('aria-hidden', 'true');
  expect(container.querySelectorAll('.editorial-segment, .editorial-playback')).toHaveLength(0);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.getAllByRole('heading')).toHaveLength(1);
  expect(container.querySelector('.perspective-features')).toHaveAttribute('aria-live', 'off');
});

it('advances on fill completion, resets the fill, and wraps all three messages', () => {
  const { complete, progress } = setup();
  for (const title of ['Thoughtful filters', 'Clearer decisions', 'Relevance scoring']) {
    const previousFill = progress();
    complete();
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(progress()).not.toBe(previousFill);
  }
});

it('pauses on hover and focus without replacing the fill, and resumes after both leave', () => {
  const { group, next, progress, complete } = setup();
  const fill = progress();
  fireEvent.pointerEnter(group);
  expect(fill.style.animationPlayState).toBe('paused');
  fireEvent.focus(next);
  fireEvent.pointerLeave(group);
  expect(fill.style.animationPlayState).toBe('paused');
  complete();
  expect(screen.getByRole('heading', { name: 'Relevance scoring' })).toBeInTheDocument();
  fireEvent.blur(next, { relatedTarget: document.body });
  expect(progress()).toBe(fill);
  expect(fill.style.animationPlayState).toBe('running');
});

it('lets Next reach every message while focus keeps rotation paused', () => {
  const { next, progress } = setup();
  fireEvent.focus(next);
  for (const title of ['Thoughtful filters', 'Clearer decisions', 'Relevance scoring']) {
    fireEvent.click(next);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(progress().style.animationPlayState).toBe('paused');
  }
});

it('pauses off-screen and in hidden tabs, and disconnects observers/listeners on unmount', () => {
  let intersect: (entries: { isIntersecting: boolean }[]) => void = () => {};
  const observe = vi.fn(), disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe = observe;
    disconnect = disconnect;
  });
  const remove = vi.spyOn(document, 'removeEventListener');
  const { group, progress, unmount } = setup();
  expect(observe).toHaveBeenCalledWith(group);
  expect(progress().style.animationPlayState).toBe('paused');
  act(() => intersect([{ isIntersecting: true }]));
  expect(progress().style.animationPlayState).toBe('running');
  const visibility = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  expect(progress().style.animationPlayState).toBe('paused');
  visibility.mockReturnValue(false);
  fireEvent(document, new Event('visibilitychange'));
  expect(progress().style.animationPlayState).toBe('running');
  act(() => intersect([{ isIntersecting: false }]));
  expect(progress().style.animationPlayState).toBe('paused');
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
});

it('observes reduced motion, prevents automatic changes and retains manual access', () => {
  let update = () => {};
  const media = { matches: true, addEventListener: vi.fn((_event, callback) => { update = callback; }), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media));
  const { complete, next, progress, unmount } = setup();
  complete();
  expect(screen.getByRole('heading', { name: 'Relevance scoring' })).toBeInTheDocument();
  fireEvent.click(next);
  expect(screen.getByRole('heading', { name: 'Thoughtful filters' })).toBeInTheDocument();
  expect(progress().style.animationPlayState).toBe('paused');
  act(() => { media.matches = false; update(); });
  expect(progress().style.animationPlayState).toBe('running');
  unmount();
  expect(media.removeEventListener).toHaveBeenCalledWith('change', update);
});

it('does not allocate JavaScript timers or update React to animate progress', () => {
  const interval = vi.spyOn(window, 'setInterval'), timeout = vi.spyOn(window, 'setTimeout');
  setup();
  expect(interval).not.toHaveBeenCalled();
  expect(timeout).not.toHaveBeenCalled();
});
