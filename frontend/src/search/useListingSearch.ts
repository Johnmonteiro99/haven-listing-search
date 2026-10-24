import { useEffect, useState } from 'react';
import { getListings, SearchApiError, type SearchParams, type SearchResponse } from '../api/listings';
import { defaultParams } from './filters';

export type RequestState =
  | { status: 'loading' | 'searching' }
  | { status: 'success'; data: SearchResponse }
  | { status: 'error'; message: string; validation: boolean };

/** Applied criteria alone trigger requests. Cleanup guards even transports that ignore abort. */
export function useListingSearch() {
  const [applied, setApplied] = useState<SearchParams>(defaultParams);
  const [attempt, setAttempt] = useState(0);
  const [request, setRequest] = useState<RequestState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    getListings(applied, controller.signal).then(data => {
      if (!controller.signal.aborted) setRequest({ status: 'success', data });
    }).catch(error => {
      if (!controller.signal.aborted) setRequest({ status: 'error',
        message: error instanceof SearchApiError ? error.message : 'Could not complete the search. Please try again.',
        validation: error instanceof SearchApiError && error.status === 422 });
    });
    return () => controller.abort();
  }, [applied, attempt]);

  function search(params: SearchParams) {
    setRequest({ status: 'searching' });
    setApplied(params);
  }
  function retry() {
    setRequest({ status: 'searching' });
    setAttempt(value => value + 1);
  }
  return { applied, request, search, retry };
}
