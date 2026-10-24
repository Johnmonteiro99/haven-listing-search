/** Decorative HAVEN imagery. Property images are illustrative, never MLS photos. */
export const imageAssets = {
  filtersResponsive: {
    light: { original: '/images/filters/haven-filters-panel-day.png', small: '/images/filters/haven-filters-panel-day-480.webp', medium: '/images/filters/haven-filters-panel-day-941.webp' },
    dark: { original: '/images/filters/haven-filters-panel-night.png', small: '/images/filters/haven-filters-panel-night-480.webp', medium: '/images/filters/haven-filters-panel-night-941.webp' },
  },
  hero: {
    light: '/images/hero/hero-light.png',
    dark: '/images/hero/hero-dark.png',
  },
  heroResponsive: {
    light: {
      small: '/images/hero/hero-light-640.webp',
      medium: '/images/hero/hero-light-1024.webp',
      large: '/images/hero/hero-light-1672.webp',
    },
    dark: {
      small: '/images/hero/hero-dark-640.webp',
      medium: '/images/hero/hero-dark-1024.webp',
      large: '/images/hero/hero-dark-1672.webp',
    },
  },
  propertyResponsive: [
    { small: '/images/properties/property-beach-480.webp', large: '/images/properties/property-beach-800.webp', position: '50% 50%' },
    { small: '/images/properties/property-california-hills-480.webp', large: '/images/properties/property-california-hills-800.webp', position: '40% 50%' },
    { small: '/images/properties/property-forest-glass-480.webp', large: '/images/properties/property-forest-glass-800.webp', position: '50% 50%' },
    { small: '/images/properties/property-desert-480.webp', large: '/images/properties/property-desert-800.webp', position: '50% 50%' },
    { small: '/images/properties/property-alpine-480.webp', large: '/images/properties/property-alpine-800.webp', position: '50% 50%' },
    { small: '/images/properties/property-lakeside-480.webp', large: '/images/properties/property-lakeside-800.webp', position: '50% 50%' },
  ],
  footerResponsive: {
    light: { small: '/images/footer/footer-light-640.webp', large: '/images/footer/footer-light-1024.webp' },
    dark: { small: '/images/footer/footer-dark-640.webp', large: '/images/footer/footer-dark-1024.webp' },
  },
  footer: {
    light: '/images/footer/footer-light.png',
    dark: '/images/footer/footer-dark.png',
  },
  // Keep this canonical order stable: changing it remaps listing illustrations.
  properties: [
    '/images/properties/property-beach.png',
    '/images/properties/property-california-hills.png',
    '/images/properties/property-forest-glass.png',
    '/images/properties/property-desert.png',
    '/images/properties/property-alpine.png',
    '/images/properties/property-lakeside.png',
  ],
} as const;
