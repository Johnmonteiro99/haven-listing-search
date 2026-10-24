import { AppearanceControl, type AppearanceControlProps } from './AppearanceControl';

export function SiteHeader(props: AppearanceControlProps) {
  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="HAVEN home">HAVEN</a>
      <nav aria-label="Main navigation">
        <a href="#search">Discover</a>
        <a href="#perspective">Our perspective</a>
      </nav>
      <AppearanceControl {...props} />
    </header>
  );
}
