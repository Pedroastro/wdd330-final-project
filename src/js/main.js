import Movie from './Movie.mjs';
const TMDB_ACCESS_TOKEN =
  typeof __TMDB_ACCESS_TOKEN__ !== 'undefined' ? __TMDB_ACCESS_TOKEN__ : '';

const GENRES_URL = 'https://api.themoviedb.org/3/genre/movie/list?language=en';

const fetchOptions = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
  },
};

export async function loadGenres() {
  if (!TMDB_ACCESS_TOKEN) {
    console.warn(
      'TMDB access token is missing. Set VITE_TMDB_API_ACCESS_TOKEN (or TMDB_API_ACCESS_TOKEN)',
    );
    return {};
  }

  const response = await fetch(GENRES_URL, fetchOptions);
  if (!response.ok) {
    console.error(
      'Failed to fetch genres',
      response.status,
      response.statusText,
    );
    return {};
  }

  const data = await response.json();
  const map = {};
  const list = Array.isArray(data?.genres) ? data.genres : [];
  for (const item of list) {
    if (Number.isFinite(Number(item?.id)) && typeof item?.name === 'string') {
      map[Number(item.id)] = item.name;
    }
  }
  return map;
}

export let genreIdToName = {};

let selectedGenreId = '';
let lastSearchResults = [];
let lastSearchQuery = '';

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

function upsertRecent(item, max = 50) {
  const list = readListFromStorage(STORAGE_RECENTS);
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

(function attachDOMContentLoaded() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGenresUI);
    document.addEventListener('DOMContentLoaded', initNavigationToDetails);
    document.addEventListener('DOMContentLoaded', initSearch);
    document.addEventListener('DOMContentLoaded', initGenreRecommendations);
  } else {
    initGenresUI();
    initNavigationToDetails();
    initSearch();
    initGenreRecommendations();
  }
})();

function initGenresUI() {
  if (Object.keys(genreIdToName).length > 0) {
    populateGenreChips(genreIdToName);
  }
}

function populateGenreChips(map) {
  const container = document.getElementById('genre-chips');
  if (!container || !map || Object.keys(map).length === 0) return;

  const entries = Object.entries(map).map(([id, name]) => ({
    id: Number(id),
    name,
  }));
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const fragment = document.createDocumentFragment();
  for (const { id, name } of entries) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.dataset.genre = String(id);
    btn.type = 'button';
    btn.textContent = name;
    fragment.appendChild(btn);
  }

  container.innerHTML = '';
  container.appendChild(fragment);
}

(async () => {
  try {
    genreIdToName = await loadGenres();
    populateGenreChips(genreIdToName);
  } catch (error) {
    console.error('Error loading genres', error);
    genreIdToName = {};
  }
})();

function initNavigationToDetails() {
  const resultsGrid = document.getElementById('results-grid');
  const recsGrid = document.getElementById('recommendations-grid');

  const handler = (event) => {
    if (event.target.closest('.fav-btn')) return;
    const candidate = event.target.closest(
      '[data-movie-id], [data-id], [data-tmdb-id], [data-movie], a[href*="movie.html?id="]',
    );
    if (!candidate) return;

    let movieId = '';
    movieId =
      candidate.getAttribute('data-movie-id') ||
      candidate.getAttribute('data-tmdb-id') ||
      candidate.getAttribute('data-id') ||
      candidate.getAttribute('data-movie') ||
      '';

    if (!movieId && candidate.tagName === 'A') {
      try {
        const url = new URL(candidate.href, window.location.origin);
        movieId = url.searchParams.get('id') || '';
      } catch (error) {
        //
      }
    }

    if (!movieId) {
      const ds = candidate.dataset || {};
      const possibleKeys = ['movieId', 'tmdbId', 'id', 'movie'];
      for (const key of possibleKeys) {
        if (ds[key]) {
          movieId = ds[key];
          break;
        }
      }
    }

    if (!movieId) return;
    try {
      const card = candidate.closest('.card');
      const titleEl = card ? card.querySelector('.title') : null;
      const imgEl = card ? card.querySelector('img.poster') : null;
      const title = titleEl ? String(titleEl.textContent || '') : '';
      const poster = imgEl ? String(imgEl.getAttribute('src') || '') : '';
      const year = card ? String(card.dataset.year || '') : '';
      if (movieId) upsertRecent({ id: Number(movieId), title, poster, year });
    } catch (error) {
      //
    }
    event.preventDefault();
    window.location.href = `/movie.html?id=${encodeURIComponent(movieId)}`;
  };

  if (resultsGrid) resultsGrid.addEventListener('click', handler);
  if (recsGrid) recsGrid.addEventListener('click', handler);

  const favHandler = (event) => {
    const btn = event.target.closest('.fav-btn');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const card = btn.closest('.card');
    if (!card) return;
    const titleEl = card.querySelector('.title');
    const imgEl = card.querySelector('img.poster');
    const movieId = Number(
      card.dataset.movieId || card.getAttribute('data-movie-id') || 0,
    );
    const title = titleEl ? String(titleEl.textContent || '') : '';
    const poster = imgEl ? String(imgEl.getAttribute('src') || '') : '';
    const year = String(card.dataset.year || '');
    const { active } = toggleFavoriteItem({ id: movieId, title, poster, year });
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    const path = btn.querySelector('path');
    if (path) path.setAttribute('fill', active ? 'currentColor' : 'none');
    if (location.pathname.endsWith('/library.html')) {
      try {
        const mount = document.getElementById('favorites-grid');
        if (mount) {
          const favorites = JSON.parse(
            localStorage.getItem('wtw.favorites') || '[]',
          );
          if (Array.isArray(favorites)) {
            mount.innerHTML = favorites.length
              ? favorites
                  .map((it) => {
                    const isFav = true;
                    const posterMarkup = it.poster
                      ? `<img class="poster" src="${it.poster}" alt="${it.title || 'Untitled'} poster">`
                      : `<div class="poster" aria-label="No poster available"></div>`;
                    return `
                      <article class="card" data-movie-id="${it.id}" data-year="${it.year || ''}">
                        <button class="fav-btn" type="button" aria-pressed="${isFav ? 'true' : 'false'}" title="Favorite">
                          <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M12 21s-6-4.35-9-7.5C1.5 12 1 9.5 3 8c1.5-1.1 3.5-.5 4.5.5L12 9.5l4.5-1c1-1 3-1.6 4.5-.5 2 1.5 1.5 4 0 5.5C18 16.65 12 21 12 21Z" stroke="currentColor" stroke-width="1.5" fill="currentColor"/>
                          </svg>
                        </button>
                        ${posterMarkup}
                        <div class="card-body">
                          <h3 class="title">${it.title || 'Untitled'}</h3>
                          <div class="meta"><span>${it.year || ''}</span></div>
                        </div>
                      </article>`;
                  })
                  .join('')
              : `
                <div class="empty-state" id="fav-empty">
                  <svg class="empty-illustration" width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="15" y="30" width="90" height="60" rx="10" stroke="currentColor" opacity=".2" />
                    <circle cx="40" cy="50" r="4" fill="currentColor" opacity=".2" />
                    <circle cx="80" cy="70" r="4" fill="currentColor" opacity=".2" />
                    <path d="M40 30v60M80 30v60" stroke="currentColor" opacity=".1" />
                  </svg>
                  <p>No favorites yet.</p>
                </div>`;
          }
        }
      } catch (error) {
        //
      }
    }
  };
  if (resultsGrid) resultsGrid.addEventListener('click', favHandler);
  if (recsGrid) recsGrid.addEventListener('click', favHandler);
}

function initSearch() {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  if (!form || !input) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = String(input.value || '').trim();
    lastSearchQuery = query;

    if (!query) {
      clearResultsToEmptyState();
      return;
    }

    if (!TMDB_ACCESS_TOKEN) {
      console.warn(
        'TMDB access token is missing. Set VITE_TMDB_API_ACCESS_TOKEN (or TMDB_API_ACCESS_TOKEN).',
      );
      showResultsMessage('Missing API token.');
      return;
    }

    setResultsLoading(true);
    try {
      const movies = await searchMovies(query);
      lastSearchResults = movies;
      const filtered = filterBySelectedGenre(movies);
      renderSearchResults(filtered, query);
    } catch (error) {
      console.error('Search failed', error);
      showResultsMessage('Failed to load results.');
    } finally {
      setResultsLoading(false);
    }
  });
}

async function searchMovies(query) {
  const baseUrl =
    'https://api.themoviedb.org/3/search/movie?include_adult=false&language=en-US&page=1';
  const url = `${baseUrl}&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
    },
  });
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return Movie.listFromApi(results);
}

function renderSearchResults(movies, query) {
  const grid = document.getElementById('results-grid');
  const countEl = document.getElementById('results-count');
  const emptyState = document.getElementById('empty-state');
  const titleEl = document.getElementById('results-title');
  if (!grid) return;

  if (emptyState) emptyState.remove();

  const safeMovies = Array.isArray(movies) ? movies : [];
  const parts = safeMovies.map(createResultCard).join('');
  grid.innerHTML =
    parts || '<div class="empty-state"><p>No results found.</p></div>';
  applyPosterLoadEffects(grid);

  if (countEl)
    countEl.textContent = parts
      ? `${safeMovies.length} result${safeMovies.length === 1 ? '' : 's'}`
      : '';
  if (titleEl && query) titleEl.textContent = `Results for "${query}"`;
}

function createResultCard(movie) {
  const poster = movie.getPosterUrl('w342');
  const title = movie.title || 'Untitled';
  const year = movie.releaseYear;
  const ratingLabel = movie.ratingLabel;
  const fav = isFavoriteId(movie.id);

  const posterMarkup = poster
    ? `<img class='poster' src='${poster}' alt='${title} poster' loading='lazy' decoding='async'>`
    : `<div class='poster' aria-label='No poster available'></div>`;

  return `
    <article class="card" data-movie-id="${movie.id}" data-year="${year || ''}">
      <button class="fav-btn" type="button" aria-label="${
        fav ? 'Remove from favorites' : 'Add to favorites'
      }" aria-pressed="${fav ? 'true' : 'false'}" title="Favorite">
        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path class="heart-outline" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="heart-fill" d="M12 21.35c-3.1-2.2-9-6.3-9-10.6C3 8 4.8 6.2 6.75 6.2c1.4 0 2.78.64 3.58 1.77.2.28.6.28.8 0 .8-1.13 2.18-1.77 3.6-1.77C16.7 6.2 18.5 8 18.5 10.75c0 4.3-5.9 8.4-9 10.6Z" fill="currentColor"/>
        </svg>
      </button>
      ${posterMarkup}
      <div class="card-body">
        <h3 class="title">${title}</h3>
        <div class="meta">
          <span>${year || ''}</span>
          <span>${ratingLabel ? `⭐ ${ratingLabel}` : ''}</span>
        </div>
      </div>
    </article>
  `;
}

function clearResultsToEmptyState() {
  const grid = document.getElementById('results-grid');
  const countEl = document.getElementById('results-count');
  const titleEl = document.getElementById('results-title');
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state" id="empty-state">
      <svg class="empty-illustration" width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="15" y="30" width="90" height="60" rx="10" stroke="currentColor" opacity=".2" />
        <circle cx="40" cy="50" r="4" fill="currentColor" opacity=".2" />
        <circle cx="80" cy="70" r="4" fill="currentColor" opacity=".2" />
        <path d="M40 30v60M80 30v60" stroke="currentColor" opacity=".1" />
      </svg>
      <p>Start typing to search for movies.</p>
      <small class="muted">Powered by TMDB</small>
    </div>
  `;
  if (countEl) countEl.textContent = '';
  if (titleEl) titleEl.textContent = 'Results';
}

function showResultsMessage(message) {
  const grid = document.getElementById('results-grid');
  const countEl = document.getElementById('results-count');
  if (!grid) return;
  grid.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
  if (countEl) countEl.textContent = '';
}

function setResultsLoading(isLoading) {
  const button = document.getElementById('search-button');
  if (!button) return;
  if (isLoading) {
    button.setAttribute('disabled', 'true');
    button.textContent = 'Searching...';
  } else {
    button.removeAttribute('disabled');
    button.textContent = 'Search';
  }
}

function initGenreRecommendations() {
  const chips = document.getElementById('genre-chips');
  const recsGrid = document.getElementById('recommendations-grid');
  if (!chips || !recsGrid) return;

  chips.addEventListener('click', async (event) => {
    const btn = event.target.closest('.chip');
    if (!btn || !chips.contains(btn)) return;

    const genreId = btn.dataset.genre || '';
    if (!genreId) return;

    const nowActive = setActiveGenreChip(btn);
    selectedGenreId = nowActive ? genreId : '';

    if (Array.isArray(lastSearchResults) && lastSearchResults.length > 0) {
      const filtered = filterBySelectedGenre(lastSearchResults);
      renderSearchResults(filtered, lastSearchQuery);
    }
    if (!nowActive) {
      resetRecommendationsToEmptyState();
      return;
    }

    if (!TMDB_ACCESS_TOKEN) {
      console.warn(
        'TMDB access token is missing. Set VITE_TMDB_API_ACCESS_TOKEN (or TMDB_API_ACCESS_TOKEN).',
      );
      showRecommendationsMessage('Missing API token.');
      return;
    }

    setRecommendationsLoading(true);
    try {
      const movies = await discoverMoviesByGenre(genreId);
      renderRecommendations(movies);
      const empty = document.getElementById('recs-empty-state');
      if (empty) empty.remove();
    } catch (error) {
      console.error('Failed to load recommendations', error);
      showRecommendationsMessage('Failed to load recommendations.');
    } finally {
      setRecommendationsLoading(false);
    }
  });
}

async function discoverMoviesByGenre(genreId) {
  const baseUrl =
    'https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=1&sort_by=vote_count.desc';
  const url = `${baseUrl}&with_genres=${encodeURIComponent(genreId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
    },
  });
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return Movie.listFromApi(results);
}

function renderRecommendations(movies) {
  const grid = document.getElementById('recommendations-grid');
  if (!grid) return;
  const safeMovies = Array.isArray(movies) ? movies : [];
  const parts = safeMovies.map(createResultCard).join('');
  grid.innerHTML =
    parts || '<div class="empty-state"><p>No recommendations found.</p></div>';
  applyPosterLoadEffects(grid);
}

function showRecommendationsMessage(message) {
  const grid = document.getElementById('recommendations-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
}

function setRecommendationsLoading(isLoading) {
  const grid = document.getElementById('recommendations-grid');
  if (!grid) return;
  if (isLoading) {
    grid.innerHTML = '<div class="empty-state"><p>Loading…</p></div>';
  }
}

function filterBySelectedGenre(movies) {
  const list = Array.isArray(movies) ? movies : [];
  if (!selectedGenreId) return list;
  const idNum = Number(selectedGenreId);
  if (!Number.isFinite(idNum)) return list;
  return list.filter(
    (m) => Array.isArray(m.genreIds) && m.genreIds.includes(idNum),
  );
}

function resetRecommendationsToEmptyState() {
  const grid = document.getElementById('recommendations-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state" id="recs-empty-state">
      <svg class="empty-illustration" width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="15" y="30" width="90" height="60" rx="10" stroke="currentColor" opacity=".2" />
        <circle cx="40" cy="50" r="4" fill="currentColor" opacity=".2" />
        <circle cx="80" cy="70" r="4" fill="currentColor" opacity=".2" />
        <path d="M40 30v60M80 30v60" stroke="currentColor" opacity=".1" />
      </svg>
      <p>Select a genre to see recommendations.</p>
      <small class="muted">Powered by TMDB</small>
    </div>
  `;
}

function setActiveGenreChip(clickedButton) {
  const chips = document.querySelectorAll('#genre-chips .chip');
  const wasActive =
    clickedButton.classList.contains('active') ||
    clickedButton.getAttribute('aria-pressed') === 'true';

  const shouldActivate = !wasActive;

  chips.forEach((chip) => {
    const pressed = shouldActivate && chip === clickedButton;
    chip.classList.toggle('active', pressed);
    chip.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  });

  return shouldActivate;
}

function applyPosterLoadEffects(root) {
  try {
    const scope = root || document;
    const images = scope.querySelectorAll('img.poster');
    images.forEach((img) => {
      if (img.complete) {
        requestAnimationFrame(() => img.classList.add('loaded'));
        return;
      }
      img.addEventListener('load', () => img.classList.add('loaded'), {
        once: true,
      });
      img.addEventListener(
        'error',
        () => {
          img.classList.add('loaded');
        },
        { once: true },
      );
    });
  } catch (error) {
    //
  }
}
