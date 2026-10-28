// Static GitHub Pages redirects keep bookmarks, query parameters and anchors.
(() => {
  const destination = document.currentScript.getAttribute('data-redirect-to');
  if (destination && destination.startsWith('/') && !destination.startsWith('//')) {
    window.location.replace(destination + window.location.search + window.location.hash);
  }
})();
