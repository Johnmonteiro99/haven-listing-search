import { useId, type FormEvent, type RefObject } from 'react';
import { ResultsViewToggle, type ResultsView } from '../components/ResultsViewToggle';
import type { AppearanceControlProps } from '../components/AppearanceControl';

interface MobileMapHeaderProps {
  city: string;
  error?: string;
  errorRef: RefObject<HTMLParagraphElement | null>;
  onCityChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onFilters: (opener: HTMLButtonElement) => void;
  onViewChange: (view: ResultsView) => void;
  appearance?: AppearanceControlProps;
}

/** Controlled phone search: the same draft and submit action as the original form. */
export function MobileMapHeader({ city, error, errorRef, onCityChange, onSearch, onFilters, onViewChange, appearance }: MobileMapHeaderProps) {
  const id = useId();
  return <header className="mobile-map-header" aria-label="Mobile map search">
    <div className="mobile-map-brand-row">
      <span className="wordmark">HAVEN</span>
      <ResultsViewToggle view="map" onChange={onViewChange} />
      {appearance && <button className="mobile-map-theme" type="button" role="switch" aria-label="Dark appearance"
        aria-checked={appearance.theme === 'dark'} onClick={() => appearance.onThemeChange(appearance.theme === 'dark' ? 'light' : 'dark')}>
        <span aria-hidden="true">{appearance.theme === 'dark' ? '☾' : '☼'}</span>
      </button>}
    </div>
    <form className="mobile-map-search" aria-label="Map city search" noValidate onSubmit={onSearch}>
      <button type="submit" aria-label="Search city" className="mobile-map-search-submit">
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg>
      </button>
      <label className="visually-hidden" htmlFor={`${id}-city`}>Search a city</label>
      <input id={`${id}-city`} name="city" type="search" enterKeyHint="search" autoComplete="off" placeholder="Search a city…"
        value={city} onChange={event => onCityChange(event.target.value)} />
      <button className="mobile-map-filters" type="button" aria-haspopup="dialog" onClick={event => onFilters(event.currentTarget)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 7h18M3 17h18"/><circle cx="9" cy="7" r="3" fill="var(--surface)"/><circle cx="15" cy="17" r="3" fill="var(--surface)"/></svg>
        Filters
      </button>
    </form>
    {error && <p ref={errorRef} className="mobile-map-error" tabIndex={-1} role="alert">{error}</p>}
  </header>;
}
