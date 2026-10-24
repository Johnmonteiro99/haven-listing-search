import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { imageAssets } from '../assets/images';
import type { SearchParams } from '../api/listings';
import { emptyFilters, validateFilters, type FilterDraft, type FilterErrors } from '../search/filters';
import type { ResolvedTheme } from '../theme/useTheme';
import { AdvancedFilterFields } from './AdvancedFilterFields';

interface AdvancedFilterDialogProps {
  initialDraft: FilterDraft;
  pageSize: number;
  theme: ResolvedTheme;
  opener: HTMLButtonElement | null;
  onDismiss: () => void;
  onApply: (draft: FilterDraft, params: SearchParams) => void;
}

/** Mounting takes a disposable snapshot. Only a valid Apply commits it to the existing search owner. */
export function AdvancedFilterDialog({ initialDraft, pageSize, theme, opener, onDismiss, onApply }: AdvancedFilterDialogProps) {
  const [draft, setDraft] = useState<FilterDraft>(() => ({ ...initialDraft }));
  const [errors, setErrors] = useState<FilterErrors>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const applyButton = useRef<HTMLButtonElement>(null);
  const summary = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const image = imageAssets.filtersResponsive[theme];

  useEffect(() => {
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    element.showModal();
    close.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener]);
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    summary.current?.focus({ preventScroll: true });
    summary.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [errors]);

  function apply(event: FormEvent) {
    event.preventDefault();
    const result = validateFilters(draft, 1, pageSize);
    setErrors(result.errors);
    if (!Object.keys(result.errors).length) onApply(draft, result.params);
  }

  return <dialog ref={dialog} className="advanced-filter-dialog" aria-labelledby={`${id}-heading`}
    onKeyDown={event => {
      // Keep the two stable keyboard boundaries inside the sheet, including Chrome's browser-UI handoff.
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === close.current) {
        event.preventDefault(); applyButton.current?.focus();
      } else if (!event.shiftKey && document.activeElement === applyButton.current) {
        event.preventDefault(); close.current?.focus();
      }
    }}
    onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <div className="advanced-filter-layout">
      <aside className="advanced-filter-art" aria-hidden="true">
        <img src={image.medium} srcSet={`${image.small} 480w, ${image.medium} 941w`} sizes="(max-width: 767px) 100vw, 320px" alt="" />
        <div><p className="eyebrow">A more considered search</p><h2>Find what feels like home.</h2>
          <p>Refine your search with a more considered approach.</p></div>
      </aside>
      <form className="advanced-filter-form" aria-label="Advanced filters" noValidate onSubmit={apply}>
        <header className="advanced-filter-heading"><h2 id={`${id}-heading`}>Filters</h2>
          <button ref={close} type="button" className="advanced-filter-close" aria-label="Close" onClick={onDismiss}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
          </button></header>
        <div className="advanced-filter-content" onFocus={event => {
          // Honor scroll-padding for the complete focus ring above the fixed action footer.
          event.target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        }}>
          {Object.keys(errors).length > 0 && <p ref={summary} tabIndex={-1} role="alert" className="form-error">Please check your filters. {Object.values(errors).join(' ')}</p>}
          <AdvancedFilterFields prefix={id} draft={draft} errors={errors}
            onChange={(key, value) => setDraft(previous => ({ ...previous, [key]: value }))} />
        </div>
        <footer className="advanced-filter-actions">
          <button type="button" className="text-button" onClick={() => { setDraft({ ...emptyFilters }); setErrors({}); }}>Reset all</button>
          <button ref={applyButton} type="submit" className="primary-button">Apply filters</button>
        </footer>
      </form>
    </div>
  </dialog>;
}
