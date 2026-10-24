import { ThemeImage } from './ThemeImage';
import { imageAssets } from '../assets/images';
import type { ResolvedTheme } from '../theme/useTheme';

function sourceFor(theme: ResolvedTheme) {
  const image = imageAssets.heroResponsive[theme];
  return { src: image.large, srcSet: `${image.small} 640w, ${image.medium} 1024w, ${image.large} 1672w` };
}
const sources = { light: sourceFor('light'), dark: sourceFor('dark') };

/** Keep illustration decorative and geometry stable while selecting theme sources. */
export function Hero({ theme }: { theme: ResolvedTheme }) {

  return (
    <section className="hero" aria-labelledby="hero-heading">
      <ThemeImage theme={theme} sources={sources} className="hero-image"
        sizes="(min-width: 1440px) 1360px, 100vw" width={1672} height={941} priority />
      <div className="hero-overlay" />
      <div className="hero-content">
        <p className="eyebrow">Find what belongs</p>
        <h1 id="hero-heading">Extraordinary homes<br className="desktop-break" /> for a more intentional life.</h1>
        <div className="hero-rule" />
        <p className="hero-caption">A considered search.<br />A clearer perspective.</p>
      </div>
      <p className="hero-signature" aria-hidden="true">People<br />Places<br />Possibilities</p>
    </section>
  );
}
