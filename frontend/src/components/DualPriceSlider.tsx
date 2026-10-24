import type { CSSProperties } from 'react';
import type { FilterDraft } from '../search/filters';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Keep raw strings in the owner; clamp only a moved handle against the other valid bound. */
export function DualPriceSlider({ draft, limit, hintId, id, onChange }: {
  draft: FilterDraft; limit: number; hintId: string; id: string;
  onChange: (key: keyof FilterDraft, value: string) => void;
}) {
  function bound(key: 'minPrice' | 'maxPrice') {
    const value = Number(draft[key]);
    return draft[key].trim() && Number.isFinite(value) && value >= 0 ? value : null;
  }
  const min = bound('minPrice'), max = bound('maxPrice');
  const lower = Math.min(limit, min ?? 0), upper = Math.min(limit, max ?? limit);
  return <div className="dual-price-control">
    <div className="dual-price-labels"><span>Minimum</span><span>Maximum</span></div>
    <div className={`dual-price-slider${lower === upper ? ' handles-together' : ''}`} style={{
      '--range-start': `${lower / limit * 100}%`, '--range-end': `${upper / limit * 100}%`,
    } as CSSProperties}>
      <div className="dual-price-track" aria-hidden="true"><span /></div>
      {(['minPrice', 'maxPrice'] as const).map(key => {
        const raw = draft[key].trim(), value = Number(raw);
        const position = key === 'minPrice' ? lower : upper;
        const announcement = !raw ? 'No limit' : !Number.isFinite(value) || value < 0 ? 'Check numeric amount' :
          `${money.format(value)}${value > limit ? ', above slider range; edit the numeric amount' : ''}`;
        return <input key={key} className={`dual-price-${key}`} id={`${id}-${key}-slider`} type="range"
          aria-label={key === 'minPrice' ? 'Minimum price slider' : 'Maximum price slider'}
          min="0" max={limit} step="10000" value={position} aria-valuetext={announcement} aria-describedby={hintId}
          onChange={event => {
            const requested = Number(event.target.value);
            const next = key === 'minPrice' ? Math.min(requested, max ?? limit) : Math.max(requested, min ?? 0);
            onChange(key, String(next));
          }} />;
      })}
    </div>
    <div className="dual-price-axis" aria-hidden="true"><span>$0</span><span>{money.format(limit)}</span></div>
  </div>;
}
