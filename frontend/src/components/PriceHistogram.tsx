import type { ReactNode } from 'react';
import type { DistributionState } from '../search/usePriceDistribution';
import { priceBinSelected, type PriceBin } from '../search/priceHistogram';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** The visual bars are supplemental; a caption and expandable counts expose the same data as text. */
export function PriceHistogram({ state, bins, minimum, maximum, onRetry, children }: {
  state: DistributionState; bins: PriceBin[]; minimum: number | null; maximum: number | null; onRetry: () => void; children: ReactNode;
}) {
  if (state.status !== 'ready') return <><div className="price-distribution-message" role="status">
    {state.status === 'loading' ? 'Loading price distribution…' : state.status === 'invalid' ?
      'Enter a valid minimum bedroom value to load price data.' : 'Price data could not be loaded.'}
    {state.status === 'error' && <button type="button" className="text-button" onClick={onRetry}>Retry price data</button>}
  </div>{children}</>;
  if (!state.prices.length) return <><p className="price-distribution-message" role="status">No price data available for this search.</p>{children}</>;
  const maxCount = Math.max(...bins.map(bin => bin.count), 1);
  const low = Math.min(...state.prices), high = Math.max(...state.prices);
  return <figure className="price-histogram" aria-label="Listing price distribution">
    <figcaption role="status">{state.prices.length} listing records · {money.format(low)}–{money.format(high)}. Includes all matching API pages before price limits.</figcaption>
    <div className="price-histogram-bars" aria-hidden="true">
      {bins.map((bin, index) => <span key={index} data-count={bin.count} data-selected={priceBinSelected(bin, index, minimum, maximum)}
        style={{ height: `${bin.count / maxCount * 100}%` }} />)}
    </div>
    {children}
    <details className="price-distribution-counts"><summary>Price distribution counts</summary>
      <p>20 equal-width bins. Highlighted bars overlap your selected range; muted bars show the remaining price distribution. Exact counts and overlap are listed below.</p>
      <ul>{bins.map((bin, index) => <li key={index}>{money.format(bin.start)} to {money.format(bin.end)}{index === bins.length - 1 ? ', inclusive' : ', upper limit excluded'}: {bin.count} {bin.count === 1 ? 'record' : 'records'}{priceBinSelected(bin, index, minimum, maximum) ? ' · overlaps selected range' : ''}</li>)}</ul>
    </details>
  </figure>;
}
