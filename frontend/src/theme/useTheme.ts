import { useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
const STORAGE_KEY = 'haven-theme';
const SYSTEM_QUERY = '(prefers-color-scheme: dark)';

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

/** Track system changes while preserving explicit user overrides and cleanup. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => matchMedia(SYSTEM_QUERY).matches);
  const theme: ResolvedTheme = preference === 'system'
    ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const media = matchMedia(SYSTEM_QUERY);
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function selectTheme(next: ThemePreference) {
    setPreference(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch { /* Keep the override for this session when persistence is unavailable. */ }
  }

  return { preference, theme, selectTheme };
}
