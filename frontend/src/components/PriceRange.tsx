import { useEffect, useRef, useState } from 'react';
import { usePriceDistribution } from '../search/usePriceDistribution';
import { buildPriceHistogram, PRICE_SLIDER_BASE_MAX } from '../search/priceHistogram';
import { PriceHistogram } from './PriceHistogram';
import { DualPriceSlider } from './DualPriceSlider';
import { validateFilters } from '../search/filters';
import { FilterFields, type FieldsProps } from './FilterFields';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Sliders are a convenience window; typed draft values never get clamped or rounded. */
export function PriceRange({ inline = false, showDistribution = false, ...props }: Omit<FieldsProps, 'fields'> & { inline?: boolean; showDistribution?: boolean }) {
  const { draft, prefix, onChange } = props;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pressedRange = useRef<HTMLInputElement | null>(null);
  const id = `${prefix}-price-range`;
  const { state: distribution, retry } = usePriceDistribution(draft, showDistribution && (inline || open));
  const histogram = buildPriceHistogram(distribution.status === 'ready' ? distribution.prices : []);
  const limit = showDistribution ? histogram.max : PRICE_SLIDER_BASE_MAX;
  function selectedBound(key: 'minPrice' | 'maxPrice', fallback: number) {
    const raw = draft[key].trim();
    return !raw ? fallback : Number.isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : null;
  }
  const slider = <DualPriceSlider draft={draft} limit={limit} hintId={`${id}-hint`} id={id} onChange={onChange} />;
  // Reuse submission rules for immediate feedback without changing applied filters.
  const validation = validateFilters(draft).errors;
  const errors = { ...props.errors, minPrice: validation.minPrice, maxPrice: validation.maxPrice };

  function close() { setOpen(false); trigger.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    // Keep the complete bounded panel visible even near the bottom of a short viewport.
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    panel.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    function outside(event: PointerEvent) {
      const target = event.target;
      // Safari blurs to an ancestor when a native range thumb is pressed.
      // Keep the popover mounted until that gesture can receive its release.
      pressedRange.current = event.button === 0 && target instanceof HTMLInputElement &&
        target.type === 'range' && root.current?.contains(target) ? target : null;
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function finishPointer() {
      const input = pressedRange.current;
      pressedRange.current = null;
      input?.focus({ preventScroll: true });
    }
    function leaveWindow() { pressedRange.current = null; setOpen(false); }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('pointerup', finishPointer);
    document.addEventListener('pointercancel', finishPointer);
    window.addEventListener('blur', leaveWindow);
    return () => {
      pressedRange.current = null;
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('pointerup', finishPointer);
      document.removeEventListener('pointercancel', finishPointer);
      window.removeEventListener('blur', leaveWindow);
    };
  }, [open]);

  const summary = errors.minPrice || errors.maxPrice ? 'Check amounts' :
    draft.minPrice.trim() || draft.maxPrice.trim() ?
      `${draft.minPrice.trim() ? money.format(Number(draft.minPrice)) : '$0'} – ${draft.maxPrice.trim() ? money.format(Number(draft.maxPrice)) : 'Any'}` : 'Any price';

  return <div className={`price-range${inline ? ' price-range-inline' : ''}`} ref={root}
    onKeyDown={event => { if (!inline && open && event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); close(); } }}
    onBlur={event => { if (!inline && !pressedRange.current && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    {!inline && <>
      <span className="control-label" id={`${id}-label`}>Price range</span>
      <button ref={trigger} type="button" className="price-trigger secondary-button" aria-labelledby={`${id}-label ${id}-summary`}
        aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        <span id={`${id}-summary`}>{summary}</span><span aria-hidden="true">⌄</span>
      </button>
    </>}
    <div ref={panel} id={id} className="price-range-panel" hidden={!inline && !open}
      role="group" aria-label="Price range amounts">
      <div className="price-range-heading"><h3>Price range</h3>
        {!inline && <button type="button" className="text-button" onClick={close}>Done</button>}</div>
      <div className="price-amounts"><FilterFields {...props} errors={errors} fields={['minPrice', 'maxPrice']} /></div>
      {showDistribution ? <PriceHistogram state={distribution} bins={histogram.bins}
        minimum={selectedBound('minPrice', 0)} maximum={selectedBound('maxPrice', Infinity)} onRetry={retry}>{slider}</PriceHistogram> : slider}
      <p className="filter-hint" id={`${id}-hint`}>Slider covers $0–{money.format(limit)}. Type any valid amount above this range for a precise search. Blank amounts mean no limit.</p>
      <button type="button" className="text-button" onClick={() => { onChange('minPrice', ''); onChange('maxPrice', ''); }}>Clear price range</button>
    </div>
  </div>;
}
