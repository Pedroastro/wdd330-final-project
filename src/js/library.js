const STORAGE_RECENTS = 'wtw.recents';
const STORAGE_FAVORITES = 'wtw.favorites';

function readListFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeListToStorage(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (error) {
    //
  }
}

function getRecents() {
  return readListFromStorage(STORAGE_RECENTS);
}

function getFavorites() {
  return readListFromStorage(STORAGE_FAVORITES);
}

function isFavoriteId(id) {
  const list = getFavorites();
  const idNum = Number(id) || 0;
  return list.some((x) => Number(x?.id) === idNum);
}

function toggleFavoriteItem(item) {
  const idNum = Number(item?.id) || 0;
  if (!idNum) return { active: false };
  const list = getFavorites();
  const idx = list.findIndex((x) => Number(x?.id) === idNum);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeListToStorage(STORAGE_FAVORITES, list);
    return { active: false };
  } else {
    const entry = {
      id: idNum,
      title: String(item?.title || ''),
      poster: String(item?.poster || ''),
      year: String(item?.year || ''),
      ts: Date.now(),
    };
    writeListToStorage(STORAGE_FAVORITES, [entry, ...list]);
    return { active: true };
  }
}

function upsertRecent(item, max = 50) {
  const list = getRecents();
  const id = Number(item?.id) || 0;
  const filtered = list.filter((x) => Number(x?.id) !== id);
  const withNew = [
    {
      id,
      title: String(item?.title || ''),
      poster: String(item?.poster || ''),
      year: String(item?.year || ''),
      ts: Date.now(),
    },
    ...filtered,
  ];
  writeListToStorage(STORAGE_RECENTS, withNew.slice(0, max));
}

function createCard(item) {
  const id = Number(item?.id) || 0;
  const title = String(item?.title || 'Untitled');
  const year = String(item?.year || '');
  const poster = String(item?.poster || '');
  const isFav = isFavoriteId(id);
  const posterMarkup = poster
    ? `<img class="poster" src="${poster}" alt="${title} poster" loading="lazy" decoding="async" />`
    : `<div class='poster' aria-label='No poster available'></div>`;
  return `
    <article class="card" data-movie-id="${id}" data-year="${year}">
      <button class="fav-btn" type="button" aria-label="${
        isFav ? 'Remove from favorites' : 'Add to favorites'
      }" aria-pressed="${isFav ? 'true' : 'false'}" title="Favorite">
        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path class="heart-outline" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="heart-fill" d="M12 21.35c-3.1-2.2-9-6.3-9-10.6C3 8 4.8 6.2 6.75 6.2c1.4 0 2.78.64 3.58 1.77.2.28.6.28.8 0 .8-1.13 2.18-1.77 3.6-1.77C16.7 6.2 18.5 8 18.5 10.75c0 4.3-5.9 8.4-9 10.6Z" fill="currentColor"/>
        </svg>
      </button>
      ${posterMarkup}
      <div class="card-body">
        <h3 class="title">${title}</h3>
        <div class="meta">
          <span>${year}</span>
        </div>
      </div>
    </article>
  `;
}

function emptyStateMarkup(kind) {
  if (kind === 'favorites') {
    return `
      <div class="empty-state" id="fav-empty">
        <svg class="empty-illustration" width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="15" y="30" width="90" height="60" rx="10" stroke="currentColor" opacity=".2" />
          <circle cx="40" cy="50" r="4" fill="currentColor" opacity=".2" />
          <circle cx="80" cy="70" r="4" fill="currentColor" opacity=".2" />
          <path d="M40 30v60M80 30v60" stroke="currentColor" opacity=".1" />
        </svg>
        <p>No favorites yet.</p>
      </div>
    `;
  }
  return `
    <div class="empty-state" id="recent-empty">
      <svg class="empty-illustration" width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="15" y="30" width="90" height="60" rx="10" stroke="currentColor" opacity=".2" />
        <circle cx="40" cy="50" r="4" fill="currentColor" opacity=".2" />
        <circle cx="80" cy="70" r="4" fill="currentColor" opacity=".2" />
        <path d="M40 30v60M80 30v60" stroke="currentColor" opacity=".1" />
      </svg>
      <p>No recent movies yet.</p>
    </div>
  `;
}

function renderGrid(gridId, items, emptyId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  const safe = Array.isArray(items) ? items : [];
  if (safe.length === 0) {
    const kind = gridId === 'favorites-grid' ? 'favorites' : 'recent';
    grid.innerHTML = emptyStateMarkup(kind);
    return;
  } else {
    const parts = safe.map(createCard).join('');
    grid.innerHTML = parts || grid.innerHTML;
    try {
      const images = grid.querySelectorAll('img.poster');
      images.forEach((img) => {
        if (img.complete) {
          requestAnimationFrame(() => img.classList.add('loaded'));
          return;
        }
        img.addEventListener('load', () => img.classList.add('loaded'), {
          once: true,
        });
        img.addEventListener('error', () => img.classList.add('loaded'), {
          once: true,
        });
      });
    } catch (error) {
      //
    }
  }
  const empty = emptyId ? document.getElementById(emptyId) : null;
  if (empty) empty.remove();
}

function initNavigationAndFavorites() {
  const container = document.getElementById('app');
  if (!container) return;
  container.addEventListener('click', (event) => {
    const fav = event.target.closest('.fav-btn');
    if (fav) {
      event.preventDefault();
      event.stopPropagation();
      const card = fav.closest('.card');
      if (!card) return;
      const titleEl = card.querySelector('.title');
      const imgEl = card.querySelector('img.poster');
      const movieId = Number(
        card.dataset.movieId || card.getAttribute('data-movie-id') || 0,
      );
      const title = titleEl ? String(titleEl.textContent || '') : '';
      const poster = imgEl ? String(imgEl.getAttribute('src') || '') : '';
      const year = String(card.dataset.year || '');
      const { active } = toggleFavoriteItem({
        id: movieId,
        title,
        poster,
        year,
      });
      fav.setAttribute('aria-pressed', active ? 'true' : 'false');
      const path = fav.querySelector('path');
      if (path) path.setAttribute('fill', active ? 'currentColor' : 'none');

      const favorites = getFavorites();
      const recents = getRecents();
      renderGrid('favorites-grid', favorites, 'fav-empty');
      renderGrid('recent-grid', recents, 'recent-empty');
      return;
    }

    const candidate = event.target.closest(
      '[data-movie-id], a[href*="movie.html?id="]',
    );
    if (!candidate) return;
    let movieId = candidate.getAttribute('data-movie-id') || '';
    if (!movieId && candidate.tagName === 'A') {
      try {
        const url = new URL(candidate.href, window.location.origin);
        movieId = url.searchParams.get('id') || '';
      } catch (error) {
        //
      }
    }
    if (!movieId) return;
    const card = candidate.closest('.card');
    const titleEl = card ? card.querySelector('.title') : null;
    const imgEl = card ? card.querySelector('img.poster') : null;
    const title = titleEl ? String(titleEl.textContent || '') : '';
    const poster = imgEl ? String(imgEl.getAttribute('src') || '') : '';
    const year = card ? String(card.dataset.year || '') : '';
    upsertRecent({ id: Number(movieId), title, poster, year });
    event.preventDefault();
    window.location.href = `/movie.html?id=${encodeURIComponent(movieId)}`;
  });
}

function init() {
  const recents = getRecents();
  const favorites = getFavorites();
  renderGrid('recent-grid', recents, 'recent-empty');
  renderGrid('favorites-grid', favorites, 'fav-empty');
  initNavigationAndFavorites();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
