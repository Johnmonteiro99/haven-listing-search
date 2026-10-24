import { useEffect, useMemo, useState } from 'react';
import { buildSearchQuery } from '../api/listings';
import { getDistributionPrices } from '../api/priceDistribution';
import { validateFilters, type FilterDraft } from './filters';

export type DistributionState =
  | { status: 'loading' | 'invalid' | 'error' }
  | { status: 'ready'; prices: number[] };

/** Panel preview only: price edits and ranking-only budget edits never restart collection. */
export function usePriceDistribution(draft: FilterDraft, enabled: boolean) {
  const context = useMemo(() => {
    const { params, errors } = validateFilters({ ...draft, minPrice: '', maxPrice: '', targetBudget: '' });
    const { city, keyword, minBedrooms } = params;
    return { criteria: { city, keyword, minBedrooms }, valid: !Object.keys(errors).length,
      key: buildSearchQuery({ city, keyword, minBedrooms, page: 1, pageSize: 10 }) };
    // Only membership criteria belong here; no local replica of backend filtering.
  }, [draft.city, draft.keyword, draft.minBedrooms]);
  const [result, setResult] = useState<{ key: string; data: DistributionState } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !context.valid) return;
    const controller = new AbortController();
    setResult({ key: context.key, data: { status: 'loading' } });
    const timer = window.setTimeout(() => {
      getDistributionPrices(context.criteria, controller.signal).then(prices => {
        if (!controller.signal.aborted) setResult({ key: context.key, data: { status: 'ready', prices } });
      }).catch(() => {
        if (!controller.signal.aborted) setResult({ key: context.key, data: { status: 'error' } });
      });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [context, enabled, attempt]);
  const state: DistributionState = !context.valid ? { status: 'invalid' } :
    result?.key === context.key ? result.data : { status: 'loading' };
  return { state, retry: () => setAttempt(value => value + 1) };
}
