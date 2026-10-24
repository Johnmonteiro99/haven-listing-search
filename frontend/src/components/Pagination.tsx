import type { SearchResponse } from '../api/listings';

/** Keep controls bounded for large totals; all page slices still come from the server. */
export function Pagination({ data, onPage }: { data: SearchResponse; onPage: (page: number) => void }) {
  if (data.totalPages === 0) return null;
  const current = Math.min(data.page, data.totalPages);
  const pages = Array.from(new Set([1, current - 1, current, current + 1, data.totalPages]))
    .filter(page => page >= 1 && page <= data.totalPages).sort((a, b) => a - b);
  return <nav className="pagination" aria-label="Results pagination">
    <button className="secondary-button" type="button" disabled={data.page <= 1}
      onClick={() => onPage(Math.min(data.page - 1, data.totalPages))}>Previous page</button>
    <div className="page-numbers">{pages.map((page, index) => <span className="page-number-group" key={page}>
      {index > 0 && page - pages[index - 1] > 1 && <span className="page-gap" aria-hidden="true">…</span>}
      <button className="secondary-button page-number" type="button" aria-label={`Page ${page}`}
        aria-current={page === data.page ? 'page' : undefined} disabled={page === data.page}
        onClick={() => onPage(page)}>{page}</button>
    </span>)}</div>
    <button className="secondary-button" type="button" disabled={data.page >= data.totalPages}
      onClick={() => onPage(data.page + 1)}>Next page</button>
  </nav>;
}
