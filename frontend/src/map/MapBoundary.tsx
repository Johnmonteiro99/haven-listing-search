import { Component, type ReactNode } from 'react';

/** A map import/render failure must not take search, cards, or pagination down with it. */
export class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="map-fallback" role="status">
      <h3>The map is unavailable.</h3><p>Your results are still available in the listing panel. You can also return to Grid.</p>
    </div>;
    return this.props.children;
  }
}
