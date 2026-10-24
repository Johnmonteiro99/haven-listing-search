import { useEffect, useId, useRef, type FormEvent } from 'react';
import type { SearchParams } from '../api/listings';
import { ResultsViewToggle, type ResultsView } from './ResultsViewToggle';

interface StickySearchToolbarProps {
  visible: boolean;
  city: string;
  applied: SearchParams;
  view: ResultsView;
  onCityChange: (city: string) => void;
  onSearch: (event: FormEvent) => void;
  onViewChange: (view: ResultsView) => void;
  onFilters: (button: HTMLButtonElement) => void;
  onReturnToForm: () => void;
}

/** The capsule edits the existing city draft and delegates every search/view action to its owner. */
export function StickySearchToolbar({ visible, city, applied, view, onCityChange, onSearch, onViewChange, onFilters, onReturnToForm }: StickySearchToolbarProps) {
  const toolbar = useRef<HTMLElement>(null);
  const id = useId();
  // Count supported applied criteria only; unsent city edits never change this badge.
  const activeFilters = (['minPrice', 'maxPrice', 'minBedrooms', 'targetBudget', 'keyword'] as const)
    .filter(key => applied[key] !== undefined).length;
  useEffect(() => {
    const focusedView = document.activeElement?.closest('.results-view-slot')
      ? document.activeElement.getAttribute('data-view') : null;
    if (visible && focusedView) toolbar.current?.querySelector<HTMLButtonElement>(`[data-view="${focusedView}"]`)?.focus({ preventScroll: true });
    if (!visible && toolbar.current?.contains(document.activeElement)) onReturnToForm();
  }, [visible, onReturnToForm]);
  return <nav ref={toolbar} className="sticky-search" aria-label="Search and results controls" hidden={!visible}>
    <div className="sticky-search-inner">
      <form className="capsule-form" aria-label="City search" noValidate onSubmit={onSearch}>
        <div className="capsule-city">
          <label htmlFor={`${id}-city`} className="visually-hidden">Search a city</label>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg>
          <input id={`${id}-city`} type="text" name="city" autoComplete="off" placeholder="Search a city..."
            value={city} onChange={event => onCityChange(event.target.value)} />
        </div>
        <button type="button" className="capsule-filters" aria-label="Advanced filters" aria-haspopup="dialog"
          aria-describedby={activeFilters ? `${id}-active` : undefined} onClick={event => onFilters(event.currentTarget)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none" /></svg>
          {activeFilters > 0 && <span className="capsule-filter-count" aria-hidden="true">{activeFilters}</span>}
        </button>
        {activeFilters > 0 && <span className="visually-hidden" id={`${id}-active`}>{activeFilters} additional active {activeFilters === 1 ? 'filter' : 'filters'}</span>}
        <button className="capsule-submit" type="submit" aria-label="Search">
          <span>Search</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>
      </form>
      <ResultsViewToggle view={view} onChange={onViewChange} />
    </div>
  </nav>;
}
