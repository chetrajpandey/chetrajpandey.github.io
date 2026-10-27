document.body.classList.add('js');
/* Progressive enhancement: content and navigation also work without JavaScript. */
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(expanded));
  navigation.classList.toggle('is-open', expanded);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    menuButton.focus();
  }
});
const form = document.querySelector('.publication-filters');
if (form) {
  const publications = [...document.querySelectorAll('.publication')];
  const search = document.querySelector('#pub-search');
  const year = document.querySelector('#pub-year');
  const type = document.querySelector('#pub-type');
  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    publications.forEach((publication) => {
      const visible = publication.textContent.toLocaleLowerCase().includes(query)
        && (!year.value || publication.dataset.year === year.value)
        && (!type.value || publication.dataset.type === type.value);
      publication.hidden = !visible;
      if (visible) count++;
    });
    document.querySelector('#pub-count').textContent = `${count} publication${count === 1 ? '' : 's'}`;
    document.querySelector('#no-results').hidden = count !== 0;
  };
  form.addEventListener('input', filter);
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('reset', () => setTimeout(filter, 0));
}
const pronounce = document.querySelector('[data-pronounce]');
const audio = document.querySelector('#pronunciation');
pronounce?.addEventListener('click', async () => {
  try {
    if (audio.paused) {
      await audio.play();
      pronounce.textContent = 'Ⅱ Pause pronunciation';
      document.querySelector('#audio-status').textContent = '';
    } else {
      audio.pause();
      pronounce.textContent = '▶ Hear my name';
    }
  } catch {
    document.querySelector('#audio-status').textContent = 'Audio could not play. Please try again.';
  }
});
audio?.addEventListener('ended', () => { pronounce.textContent = '▶ Hear my name'; });

// News categories keep professional service discoverable alongside research updates.
const newsFilters = [...document.querySelectorAll('[data-news-category]')];
if (newsFilters.length) {
  const updates = [...document.querySelectorAll('.news-item')];
  newsFilters.forEach((button) => button.addEventListener('click', () => {
    const category = button.dataset.newsCategory;
    let count = 0;
    updates.forEach((update) => {
      update.hidden = category !== 'All' && update.dataset.category !== category;
      if (!update.hidden) count++;
    });
    newsFilters.forEach((filter) => filter.setAttribute('aria-pressed', String(filter === button)));
    document.querySelector('#news-status').textContent = `${count} update${count === 1 ? '' : 's'}`;
  }));
}

// Cover external links written directly in Markdown as well as shared link components.
document.querySelectorAll('a[href]').forEach((link) => {
  const destination = new URL(link.href, window.location.href);
  if (['http:', 'https:'].includes(destination.protocol)
      && destination.origin !== window.location.origin) {
    link.target = '_blank';
    link.relList.add('noopener', 'noreferrer');
  }
});

// Theme preference follows the system until the visitor makes a choice.
const themeToggle = document.querySelector('.theme-toggle');
const storedTheme = () => {
  try { return localStorage.getItem('faculty-explicit-theme'); } catch (_) { return null; }
};
function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
  if (themeToggle) {
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeToggle.hidden = false;
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171b22' : '#ffffff');
}
applyTheme(document.documentElement.dataset.theme || 'light');
themeToggle?.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('faculty-explicit-theme', theme); } catch (_) {}
  applyTheme(theme);
});
window.addEventListener('storage', (event) => {
  if (event.key === 'faculty-explicit-theme') applyTheme(['light', 'dark'].includes(event.newValue) ? event.newValue : 'light');
});

// Native dialog supplies keyboard dismissal, focus containment, and modal semantics.
const hiringNotice = document.querySelector('#hiring-notice');
const hiringNoticeOpen = document.querySelector('[data-hiring-notice-open]');
if (hiringNotice && typeof hiringNotice.showModal === 'function') {
  hiringNoticeOpen.hidden = false;
  hiringNoticeOpen.addEventListener('click', () => hiringNotice.showModal());
  hiringNotice.addEventListener('close', () => hiringNoticeOpen.focus({preventScroll: true}));
  // sessionStorage survives page navigation/reloads and resets with the tab session.
  const hiringNoticeKey = 'faculty-hiring-notice-seen';
  let alreadyShown = false;
  try { alreadyShown = sessionStorage.getItem(hiringNoticeKey) === '1'; } catch (_) {}
  if (!alreadyShown) {
    hiringNotice.showModal();
    try { sessionStorage.setItem(hiringNoticeKey, '1'); } catch (_) {}
  }
}
