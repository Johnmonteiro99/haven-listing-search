import { useEffect, useRef, useState, type FormEvent } from 'react';
import { emptyFilters, validateFilters, type FilterDraft, type FilterErrors } from '../search/filters';
import { FilterFields } from './FilterFields';
import { PriceRange } from './PriceRange';
import { BedroomStepper } from './BedroomStepper';
import type { AppearanceControlProps } from './AppearanceControl';
import { SearchResults } from './SearchResults';
import { AdvancedFilterDialog } from './AdvancedFilterDialog';
import { StickySearchToolbar } from './StickySearchToolbar';
import type { ResultsView } from './ResultsViewToggle';
import { useStickySearch } from '../search/useStickySearch';
import { MobileMapHeader } from '../map/MobileMapHeader';
import { useMobileMap } from '../search/useMobileMap';
import { useListingSearch } from '../search/useListingSearch';

/** Desktop drafts and disposable modal edits share validation, never change applied criteria on typing. */
export function SearchPanel({ appearance }: { appearance?: AppearanceControlProps }) {
  const { applied, request, search, retry } = useListingSearch();
  const [draft, setDraft] = useState<FilterDraft>({ ...emptyFilters });
  const [errors, setErrors] = useState<FilterErrors>({});
  const [view, setView] = useState<ResultsView>('grid');
  const mobileMap = useMobileMap(view);
  const mobileError = useRef<HTMLParagraphElement>(null);
  const previousMobileMap = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const section = useRef<HTMLElement>(null);
  const stickyVisible = useStickySearch(form, section);
  const [panelOpen, setPanelOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const errorSummary = useRef<HTMLParagraphElement>(null);
  // Focus the visible error summary in either presentation of the shared draft.
  useEffect(() => { if (Object.keys(errors).length) (mobileMap ? mobileError : errorSummary).current?.focus(); }, [errors, mobileMap]);
  useEffect(() => {
    if (mobileMap) section.current?.querySelector<HTMLButtonElement>('.mobile-map-header [data-view=map]')?.focus({ preventScroll: true });
    else if (previousMobileMap.current) section.current?.querySelector<HTMLButtonElement>(`.results-view-slot [data-view=${view}]`)?.focus({ preventScroll: true });
    previousMobileMap.current = mobileMap;
  }, [mobileMap, view]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateFilters(draft, 1, applied.pageSize);
    setErrors(result.errors);
    if (!Object.keys(result.errors).length) search(result.params);
  }
  function openPanel(button: HTMLButtonElement) {
    opener.current = button;
    setPanelOpen(true);
  }
  function clear() {
    setDraft({ ...emptyFilters }); setErrors({});
    search({ page: 1, pageSize: 10 });
  }
  const fieldProps = { prefix: 'search', draft, errors,
    onChange: (key: keyof FilterDraft, value: string) => setDraft(previous => ({ ...previous, [key]: value })) };
  return <section ref={section} id="search" className={`search-section${mobileMap ? ' mobile-map-active' : ''}`} aria-label="Property search">
    {mobileMap && <MobileMapHeader city={draft.city} appearance={appearance} errorRef={mobileError}
      error={Object.keys(errors).length ? `Please check your filters. ${Object.values(errors).join(' ')} Open Filters to correct these amounts.` : undefined}
      onCityChange={value => fieldProps.onChange('city', value)} onSearch={submit} onFilters={openPanel} onViewChange={setView} />}
    <form hidden={mobileMap} ref={form} className="search-panel" aria-label="Search homes" noValidate onSubmit={event => submit(event)}>
      <p className="eyebrow search-eyebrow">Find your next chapter</p>
      {Object.keys(errors).length > 0 && <p ref={errorSummary} tabIndex={-1} className="form-error" role="alert">Please check your filters. {Object.values(errors).join(' ')}</p>}
      <div className="primary-filters">
        <FilterFields {...fieldProps} fields={['city']} />
        <div className="desktop-filters">
          <PriceRange {...fieldProps} />
          <BedroomStepper error={errors.minBedrooms} value={draft.minBedrooms} onChange={value => fieldProps.onChange('minBedrooms', value)} />
        </div>
        <button className="primary-button" type="submit">Search</button>
        <button type="button" className="more-filters-button secondary-button" aria-expanded={panelOpen}
          aria-haspopup="dialog" onClick={event => openPanel(event.currentTarget)}>More filters <span aria-hidden="true">+</span></button>
        <button className="mobile-filters-button secondary-button" type="button" aria-expanded={panelOpen}
          aria-haspopup="dialog" onClick={event => openPanel(event.currentTarget)}>Filters</button>
      </div>
      <div className="desktop-filter-actions">
        <button type="button" className="text-button" onClick={clear}>Clear filters</button>
      </div>
    </form>
    <StickySearchToolbar visible={stickyVisible && !mobileMap} city={draft.city} applied={applied} view={view} onViewChange={setView}
      onCityChange={value => fieldProps.onChange('city', value)} onSearch={submit} onFilters={openPanel}
      onReturnToForm={() => form.current?.querySelector('input')?.focus({ preventScroll: true })} />
    <SearchResults mobileMap={mobileMap} view={view} onViewChange={setView} stickyVisible={stickyVisible && !mobileMap} appearance={appearance} request={request} targetBudget={applied.targetBudget} onClear={clear} onRetry={retry}
      onPage={page => {
        if (Number.isInteger(page) && page >= 1) search({ ...applied, page });
      }} />
    {panelOpen && <AdvancedFilterDialog initialDraft={draft} pageSize={applied.pageSize}
      theme={appearance?.theme ?? 'light'} opener={opener.current} onDismiss={() => setPanelOpen(false)}
      onApply={(values, params) => {
        setDraft({ ...values }); setErrors({}); setPanelOpen(false); search(params);
      }} /> }
  </section>;
}
