import { useId } from 'react';
import type { ThemePreference, ResolvedTheme } from '../theme/useTheme';

export interface AppearanceControlProps {
  preference: ThemePreference;
  theme: ResolvedTheme;
  onThemeChange: (preference: ThemePreference) => void;
}

/** Share the single App theme authority across the header and modal. */
export function AppearanceControl({ preference, theme, onThemeChange }: AppearanceControlProps) {
  const hintId = useId();
  return (
    <div className="theme-control">
      <button type="button" className="theme-toggle" role="switch"
        aria-checked={theme === 'dark'} aria-label="Dark appearance"
        aria-describedby={hintId} onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}>
        <span className="theme-thumb" aria-hidden="true">
          <svg className="theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </svg>
          <svg className="theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z" />
          </svg>
        </span>
      </button>
      <span id={hintId} className="visually-hidden">Switch to {theme === 'dark' ? 'light' : 'dark'} appearance.</span>
      <button type="button" className="theme-system" aria-pressed={preference === 'system'}
        aria-label="Auto: use system appearance" onClick={() => onThemeChange('system')}>Auto</button>
    </div>
  );
}
