/** One origin for every API request; development retains Vite's /api proxy. */
export function resolveApiBaseUrl(value: string | undefined, production: boolean): string {
  const configured = value?.trim() ?? '';
  if (!configured && !production) return '';
  const message = 'VITE_API_BASE_URL must be an HTTP(S) origin; production requires a public HTTPS origin.';
  let url: URL;
  try { url = new URL(configured); } catch { throw new Error(message); }
  const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
    url.hostname.startsWith('127.') || ['0.0.0.0', '[::1]'].includes(url.hostname);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*') ||
      (production && (url.protocol !== 'https:' || local))) throw new Error(message);
  return url.origin;
}

export function apiUrl(path: `/api/${string}`): string {
  return `${resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, import.meta.env.PROD)}${path}`;
}
