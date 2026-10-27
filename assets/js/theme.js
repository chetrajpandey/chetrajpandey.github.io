// Light is the default. Only a deliberate toggle enables a saved dark preference.
(() => {
  let preference = null;
  try { preference = localStorage.getItem('faculty-explicit-theme'); } catch (_) {}
  document.documentElement.dataset.theme = preference === 'dark' ? 'dark' : 'light';
})();
