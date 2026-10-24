import { useEffect, useState } from 'react';
import type { RequestState } from '../search/useListingSearch';

/** A single timer explains slow hosting without fetching or changing request ownership. */
export function DelayedLoadingNote({ request }: { request: RequestState }) {
  const [delayed, setDelayed] = useState(false);
  const busy = request.status === 'loading' || request.status === 'searching';
  useEffect(() => {
    setDelayed(false);
    if (!busy) return;
    const timer = window.setTimeout(() => setDelayed(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [request, busy]);
  return busy && delayed ? <p className="page-summary" role="status">
    This is taking a little longer. The demo server may be waking up; the first search can take about a minute.
  </p> : null;
}
