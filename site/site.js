// Light/dark toggle: one circular button in the nav showing a sun (in
// dark mode) or a moon (in light mode). A saved choice wins; otherwise
// the OS preference decides. No tracking — the choice is stored only in
// this browser's localStorage.
(function () {
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  function apply(theme) {
    root.dataset.theme = theme;
    btn.innerHTML = SITE_ICONS[theme === 'light' ? 'moon' : 'sun'];
  }

  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (err) { /* private mode */ }
  const systemLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  apply(saved === 'light' || saved === 'dark' ? saved : (systemLight ? 'light' : 'dark'));

  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    apply(next);
    try { localStorage.setItem('theme', next); } catch (err) { /* private mode */ }
  });
})();
