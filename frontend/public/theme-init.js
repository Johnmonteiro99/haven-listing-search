// Apply the saved/system palette before the page paints. Storage may be blocked.
(() => {
  let preference = 'system';
  try {
    const saved = localStorage.getItem('haven-theme');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch { /* Browsing restrictions must not prevent rendering. */ }
  const dark = preference === 'dark' ||
    (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
