import { EditorialSlideshow } from './EditorialSlideshow';
import { ThemeImage } from './ThemeImage';
import { imageAssets } from '../assets/images';
import type { ResolvedTheme } from '../theme/useTheme';

function sourceFor(theme: ResolvedTheme) {
  const image = imageAssets.footerResponsive[theme];
  return { src: image.large, srcSet: `${image.small} 640w, ${image.large} 1024w` };
}
const sources = { light: sourceFor('light'), dark: sourceFor('dark') };

/** Explain implemented features; decorative imagery stays separate from readable text. */
export function EditorialSection({ theme }: { theme: ResolvedTheme }) {

  return <section id="perspective" className="perspective" aria-labelledby="perspective-heading">
    <div className="perspective-copy">
      <div className="perspective-intro">
        <p className="eyebrow">Search with intelligence</p>
        <h2 id="perspective-heading">More than results.<br />A clearer perspective.</h2>
        <p className="perspective-description">A thoughtful place to begin your search for what comes next.</p>
      </div>
      <EditorialSlideshow />
    </div>
    <div className="perspective-image">
      <ThemeImage theme={theme} sources={sources}
        sizes="(min-width: 1440px) 1360px, 94vw"
        width={1024} height={576} />
    </div>
  </section>;
}
