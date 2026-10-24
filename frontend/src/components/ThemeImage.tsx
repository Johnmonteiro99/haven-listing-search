import { useEffect, useState } from 'react';
import type { ResolvedTheme } from '../theme/useTheme';

interface ImageSource { src: string; srcSet: string }
interface ThemeImageProps {
  theme: ResolvedTheme;
  sources: Record<ResolvedTheme, ImageSource>;
  className?: string;
  sizes: string;
  width: number;
  height: number;
  priority?: boolean;
}

/** Load the alternate scene only when requested; retain decoded scenes for later fades. */
export function ThemeImage({ theme, sources, className = '', sizes, width, height, priority = false }: ThemeImageProps) {
  const [initialTheme] = useState(theme);
  const [loaded, setLoaded] = useState<Partial<Record<ResolvedTheme, boolean>>>({});
  const [displayed, setDisplayed] = useState(theme);

  // A slow response for an obsolete theme cannot override the current preference.
  useEffect(() => {
    if (loaded[theme]) setDisplayed(theme);
  }, [theme, loaded]);

  return (['light', 'dark'] as const).filter(mode => mode === initialTheme || mode === theme || loaded[mode]).map(mode => (
    <img key={mode} className={`${className} theme-image`} data-visible={displayed === mode}
      src={sources[mode].src} srcSet={sources[mode].srcSet} sizes={sizes}
      width={width} height={height} alt="" aria-hidden="true"
      fetchPriority={priority && mode === initialTheme ? 'high' : 'auto'}
      loading={priority ? 'eager' : 'lazy'} decoding="async"
      onLoad={event => {
        const image = event.currentTarget;
        // Decode before revealing, so an uncached image never fades through an empty frame.
        void image.decode().catch(() => {}).then(() => setLoaded(previous => ({ ...previous, [mode]: true })));
      }} />
  ));
}
