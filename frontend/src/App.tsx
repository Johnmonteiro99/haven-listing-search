import { SiteHeader } from './components/SiteHeader';
import { SearchPanel } from './components/SearchPanel';
import { EditorialSection } from './components/EditorialSection';
import { Hero } from './components/Hero';
import { useTheme } from './theme/useTheme';

export default function App() {
  const { preference, theme, selectTheme } = useTheme();

  return (
    <div id="top" className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SiteHeader theme={theme} preference={preference} onThemeChange={selectTheme} />
      <main id="main-content" tabIndex={-1}>
        <Hero theme={theme} />
        <SearchPanel appearance={{ theme, preference, onThemeChange: selectTheme }} />
        <EditorialSection theme={theme} />
      </main>
      <footer className="site-footer">
        <a className="wordmark" href="#top" aria-label="HAVEN back to top">HAVEN</a>
        <p>People. Places. Possibilities.</p>
      </footer>
    </div>
  );
}
