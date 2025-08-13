import Movie from './Movie.mjs';

const TMDB_ACCESS_TOKEN =
  typeof __TMDB_ACCESS_TOKEN__ !== 'undefined' ? __TMDB_ACCESS_TOKEN__ : '';
const WATCHMODE_API_KEY =
  typeof __WATCHMODE_API_KEY__ !== 'undefined' ? __WATCHMODE_API_KEY__ : '';
const API_BASE = 'https://api.themoviedb.org/3';
const WATCHMODE_API_BASE = 'https://api.watchmode.com/v1';
const IMG_BASE = 'https://image.tmdb.org/t/p/';

const fetchOptions = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
  },
};

function getRegionFromBrowser(defaultRegion = 'US') {
  try {
    const lang = navigator.language || navigator.userLanguage || '';
    const parts = String(lang).split('-');
    const region = parts[1] || '';
    return (region || defaultRegion).toUpperCase();
  } catch (error) {
    return defaultRegion;
  }
}

function qs(selector) {
  return document.querySelector(selector);
}

function buildProviderLogoUrl(path, size = 'w45') {
  if (!path) return '';
  return `${IMG_BASE}${size}${path}`;
}

async function fetchJson(url) {
  const resp = await fetch(url, fetchOptions);
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.json();
}

const PLACEHOLDER_DETAIL = {
  adult: false,
  backdrop_path: '/yz8QL8WFD8yj0LA5zIlNOgcHvZK.jpg',
  genre_ids: [12, 35, 878],
  id: 105,
  original_language: 'en',
  original_title: 'Back to the Future',
  overview:
    "Eighties teenager Marty McFly is accidentally sent back in time to 1955, inadvertently disrupting his parents' first meeting and attracting his mother's romantic interest. Marty must repair the damage to history by rekindling his parents' romance and - with the help of his eccentric inventor friend Doc Brown - return to 1985.",
  popularity: 14.3389,
  poster_path: '/fNOH9f1aA7XRTzl1sAOx9iF553Q.jpg',
  release_date: '1985-07-03',
  title: 'Back to the Future',
  video: false,
  vote_average: 8.322,
  vote_count: 20756,
};

function renderPlaceholder() {
  try {
    const enriched = {
      ...PLACEHOLDER_DETAIL,
      genres: [
        { name: 'Adventure' },
        { name: 'Comedy' },
        { name: 'Science Fiction' },
      ],
    };
    renderDetail(enriched);
  } catch (error) {
    //
  }
}

async function loadMovieAndProviders(movieId) {
  const lang = 'en-US';
  const region = getRegionFromBrowser('US');

  const detailUrl = `${API_BASE}/movie/${movieId}?language=${encodeURIComponent(
    lang,
  )}`;
  const tmdbProvidersUrl = `${API_BASE}/movie/${movieId}/watch/providers`;

  const [detail, watchmode, tmdb] = await Promise.all([
    fetchJson(detailUrl),
    fetchWatchmodeSources(`movie-${movieId}`).catch(() => []),
    fetchJson(tmdbProvidersUrl).catch(() => null),
  ]);

  if (Array.isArray(watchmode) && watchmode.length > 0) {
    return { detail, providers: watchmode, providersKind: 'watchmode', region };
  }
  if (tmdb && typeof tmdb === 'object' && tmdb.results) {
    return { detail, providers: tmdb, providersKind: 'tmdb', region };
  }
  return { detail, providers: null, providersKind: 'none', region };
}

function renderDetail(detail) {
  const container = qs('#movie-detail');
  if (!container) return;

  const movie = new Movie(detail);
  const poster = movie.getPosterUrl('w342');
  const title =
    movie.title || detail.title || detail.original_title || 'Untitled';
  const year = movie.releaseYear;
  const runtime = Number(detail.runtime) || 0;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  const runtimeLabel = runtime
    ? `${hours ? hours + 'h ' : ''}${minutes ? minutes + 'm' : ''}`
    : '';
  const genres = Array.isArray(detail.genres)
    ? detail.genres.map((g) => g.name).filter(Boolean)
    : [];
  const ratingLabel = movie.ratingLabel;

  container.innerHTML = `
    <div class="detail-poster-wrap">
      <img class="poster detail-poster" src="${poster}" alt="${title} poster" loading="lazy" decoding="async" />
    </div>
    <div class="detail-body">
      <h1 class="detail-title">${title}</h1>
      ${detail.tagline ? `<p class="muted detail-tagline">${detail.tagline}</p>` : ''}

      <div class="meta detail-meta">
        ${year ? `<span>${year}</span>` : ''}
        ${runtimeLabel ? `<span>${runtimeLabel}</span>` : ''}
        ${genres.length ? `<span>${genres.join(' • ')}</span>` : ''}
        ${ratingLabel ? `<span>⭐ ${ratingLabel}</span>` : ''}
      </div>

      ${detail.overview ? `<p class="detail-overview">${detail.overview}</p>` : ''}
    </div>
  `;
  try {
    const img = container.querySelector('img.poster');
    if (img) {
      if (img.complete) {
        requestAnimationFrame(() => img.classList.add('loaded'));
      } else {
        img.addEventListener('load', () => img.classList.add('loaded'), {
          once: true,
        });
        img.addEventListener('error', () => img.classList.add('loaded'), {
          once: true,
        });
      }
    }
  } catch (error) {
    //
  }
}

function groupProvidersByType(entry) {
  const order = ['flatrate', 'free', 'ads', 'rent', 'buy'];
  const result = [];
  for (const key of order) {
    const list = Array.isArray(entry?.[key]) ? entry[key] : [];
    if (list.length) result.push({ type: key, list });
  }
  return result;
}

function titleForProviderType(type) {
  switch (type) {
    case 'flatrate':
      return 'Streaming';
    case 'free':
      return 'Free';
    case 'ads':
      return 'With Ads';
    case 'rent':
      return 'Rent';
    case 'buy':
      return 'Buy';
    default:
      return type;
  }
}

function renderProviders(providers, region) {
  const mount = qs('#providers-content');
  if (!mount) return;

  const entries = providers?.results || {};
  const regionEntry =
    entries?.[region] ||
    entries?.US ||
    entries?.GB ||
    entries?.CA ||
    entries?.AU;
  if (!regionEntry) {
    mount.innerHTML = `
      <div class="empty-state"><p>No streaming information available.</p></div>
    `;
    return;
  }

  const groups = groupProvidersByType(regionEntry);
  if (!groups.length) {
    mount.innerHTML = `
      <div class="empty-state"><p>No streaming information available.</p></div>
    `;
    return;
  }

  const parts = groups
    .map(({ type, list }) => {
      const chips = list
        .map((p) => {
          const name = p.provider_name || 'Unknown';
          const logo = p.logo_path
            ? buildProviderLogoUrl(p.logo_path, 'w45')
            : '';
          return `
        <div class="chip provider-chip" title="${name}" aria-label="${name}">
          ${logo ? `<img src="${logo}" alt="" width="24" height="24" style="border-radius:6px;" />` : ''}
          <span>${name}</span>
        </div>
      `;
        })
        .join('');
      return `
      <div class="provider-group">
        <h3 class="provider-group-title">${titleForProviderType(type)}</h3>
        <div class="chips">${chips}</div>
      </div>
    `;
    })
    .join('');

  mount.innerHTML = parts;
}

async function fetchWatchmodeSources(titleId) {
  if (!WATCHMODE_API_KEY) throw new Error('WATCHMODE_API_KEY missing');
  const url = `${WATCHMODE_API_BASE}/title/${encodeURIComponent(
    titleId,
  )}/sources/?apiKey=${encodeURIComponent(WATCHMODE_API_KEY)}`;
  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.json();
}

function normalizeWatchmodeType(type) {
  switch (String(type || '').toLowerCase()) {
    case 'sub':
      return 'flatrate';
    case 'free':
      return 'free';
    case 'rent':
      return 'rent';
    case 'buy':
    case 'purchase':
      return 'buy';
    default:
      return '';
  }
}

function groupWatchmodeByType(sources, preferredRegion = 'US') {
  const upperPreferred = String(preferredRegion || 'US').toUpperCase();
  const candidates = Array.isArray(sources) ? sources : [];
  const regionsToTry = [upperPreferred, 'US', 'GB', 'CA', 'AU'];

  let filtered = [];
  for (const r of regionsToTry) {
    filtered = candidates.filter(
      (s) => String(s?.region || '').toUpperCase() === r,
    );
    if (filtered.length) break;
  }

  const buckets = { flatrate: [], free: [], rent: [], buy: [] };
  const seen = new Set();
  for (const s of filtered) {
    const type = normalizeWatchmodeType(s?.type);
    if (!type || !buckets[type]) continue;
    const name = s?.name || 'Unknown';
    const webUrl = s?.web_url || s?.ios_url || s?.android_url || '';
    const dedupeKey = `${type}|${name}|${webUrl}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    buckets[type].push({
      provider_name: name,
      logo_path: '',
      web_url: webUrl,
      format: s?.format || '',
      price: s?.price ?? null,
    });
  }

  const order = ['flatrate', 'free', 'rent', 'buy'];
  return order
    .map((type) => ({ type, list: buckets[type] }))
    .filter((g) => g.list.length > 0);
}

function renderWatchmodeProviders(sources, region) {
  const mount = qs('#providers-content');
  if (!mount) return;

  if (!WATCHMODE_API_KEY) {
    mount.innerHTML = `<div class='empty-state'><p>Watchmode API key is missing.</p></div>`;
    return;
  }

  const groups = groupWatchmodeByType(sources, region);
  if (!groups.length) {
    mount.innerHTML = `
      <div class='empty-state'><p>No streaming information available.</p></div>
    `;
    return;
  }

  const parts = groups
    .map(({ type, list }) => {
      const chips = list
        .map((p) => {
          const name = p.provider_name || 'Unknown';
          const link = p.web_url || '';
          const label = link
            ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${name}</a>`
            : `<span>${name}</span>`;
          return `
        <div class="chip provider-chip" title="${name}" aria-label="${name}">
          ${label}
        </div>
      `;
        })
        .join('');
      return `
      <div class="provider-group">
        <h3 class="provider-group-title">${titleForProviderType(type)}</h3>
        <div class="chips">${chips}</div>
      </div>
    `;
    })
    .join('');

  mount.innerHTML = parts;
}

async function init() {
  renderPlaceholder();

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const emptyDetail = qs('#detail-empty');
  const emptyProviders = qs('#providers-empty');

  if (!id || !/^[0-9]+$/.test(id)) {
    if (emptyDetail)
      emptyDetail.innerHTML = '<p>Invalid or missing movie ID.</p>';
    return;
  }

  if (!TMDB_ACCESS_TOKEN) {
    if (emptyDetail)
      emptyDetail.innerHTML = '<p>TMDB access token is missing.</p>';
    return;
  }

  try {
    const { detail, providers, providersKind, region } =
      await loadMovieAndProviders(id);
    renderDetail(detail);
    if (emptyProviders) emptyProviders.remove();
    if (providersKind === 'watchmode') {
      renderWatchmodeProviders(providers, region);
    } else if (providersKind === 'tmdb') {
      renderProviders(providers, region);
    } else {
      const mount = qs('#providers-content');
      if (mount) {
        mount.innerHTML = `
          <div class="empty-state"><p>No streaming information available.</p></div>
        `;
      }
    }
    if (emptyDetail) emptyDetail.remove();
  } catch (err) {
    console.error(err);
    if (emptyDetail)
      emptyDetail.innerHTML = '<p>Failed to load movie details.</p>';
    if (emptyProviders)
      emptyProviders.innerHTML = '<p>Failed to load streaming providers.</p>';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
