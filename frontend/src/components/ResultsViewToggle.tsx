export type ResultsView = 'grid' | 'map';

/** Both placements delegate to the same view owner; only one placement is exposed at a time. */
export function ResultsViewToggle({ view, onChange }: { view: ResultsView; onChange: (view: ResultsView) => void }) {
  return <div className="view-toggle" role="group" aria-label="Results view">
    <button type="button" data-view="grid" aria-pressed={view === 'grid'} aria-controls="results-workspace" onClick={() => onChange('grid')}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M2 2h6v6H2Zm10 0h6v6h-6ZM2 12h6v6H2Zm10 0h6v6h-6Z" /></svg>Grid
    </button>
    <button type="button" data-view="map" aria-pressed={view === 'map'} aria-controls="results-workspace" onClick={() => onChange('map')}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="m2 4 5-2 6 2 5-2v14l-5 2-6-2-5 2Zm5-2v14m6-12v14" /></svg>Map
    </button>
  </div>;
}
