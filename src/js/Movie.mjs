const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';
const POSTER_SIZES = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'];
const BACKDROP_SIZES = ['w300', 'w780', 'w1280', 'original'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clampSize(size, allowedSizes, fallback) {
  if (allowedSizes.includes(size)) return size;
  return allowedSizes.includes(fallback) ? fallback : allowedSizes[0];
}

function buildImageUrl(path, size) {
  if (!isNonEmptyString(path)) return '';
  return `${TMDB_IMAGE_BASE}${size}${path}`;
}

export class Movie {
  /**
   * @param {Object} raw - TMDB movie object
   */
  constructor(raw = {}) {
    this.raw = raw;

    // Core identifiers
    this.id = Number(raw.id) || 0;
    this.title = isNonEmptyString(raw.title) ? raw.title : '';
    this.originalTitle = isNonEmptyString(raw.original_title) ? raw.original_title : this.title;
    this.originalLanguage = isNonEmptyString(raw.original_language) ? raw.original_language : '';

    // Content/metadata
    this.overview = isNonEmptyString(raw.overview) ? raw.overview : '';
    this.adult = Boolean(raw.adult);
    this.video = Boolean(raw.video);
    this.genreIds = Array.isArray(raw.genre_ids) ? raw.genre_ids.filter(Number.isFinite) : [];

    // Popularity/votes
    this.popularity = Number(raw.popularity) || 0;
    this.voteAverage = Number(raw.vote_average) || 0;
    this.voteCount = Number(raw.vote_count) || 0;

    // Images
    this.posterPath = isNonEmptyString(raw.poster_path) ? raw.poster_path : '';
    this.backdropPath = isNonEmptyString(raw.backdrop_path) ? raw.backdrop_path : '';

    // Dates
    this.releaseDate = isNonEmptyString(raw.release_date) ? raw.release_date : '';
    this.releaseYear = this.releaseDate ? this.releaseDate.slice(0, 4) : '';
  }

  /** Returns rating scaled to 0..5 */
  get ratingOutOfFive() {
    return Math.max(0, Math.min(5, this.voteAverage / 2));
  }

  /** Returns a short rating label like "8.3 (20,753)" */
  get ratingLabel() {
    const avg = this.voteAverage.toFixed(1);
    const count = this.voteCount.toLocaleString();
    return `${avg} (${count})`;
  }

  /** Builds a poster URL for the given size */
  getPosterUrl(size = 'w500') {
    if (!this.posterPath) return '';
    const safe = clampSize(size, POSTER_SIZES, 'w500');
    return buildImageUrl(this.posterPath, safe);
  }

  /** Builds a backdrop URL for the given size */
  getBackdropUrl(size = 'w780') {
    if (!this.backdropPath) return '';
    const safe = clampSize(size, BACKDROP_SIZES, 'w780');
    return buildImageUrl(this.backdropPath, safe);
  }

  /**
   * Returns genre names if a map is provided, otherwise falls back to IDs
   * @param {Record<number, string>} genreIdToName
   * @returns {string[]}
   */
  getGenreNames(genreIdToName = {}) {
    return this.genreIds.map((id) => genreIdToName[id] || String(id));
  }

  matchesQuery(query) {
    if (!isNonEmptyString(query)) return true;
    const q = query.trim().toLowerCase();
    return (
      this.title.toLowerCase().includes(q) ||
      this.originalTitle.toLowerCase().includes(q) ||
      this.overview.toLowerCase().includes(q)
    );
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      original_title: this.originalTitle,
      original_language: this.originalLanguage,
      overview: this.overview,
      adult: this.adult,
      video: this.video,
      genre_ids: this.genreIds,
      popularity: this.popularity,
      vote_average: this.voteAverage,
      vote_count: this.voteCount,
      poster_path: this.posterPath,
      backdrop_path: this.backdropPath,
      release_date: this.releaseDate,
    };
  }

  /** Validates a raw TMDB movie object */
  static isValid(raw) {
    if (!raw || typeof raw !== 'object') return false;
    if (!Number.isFinite(Number(raw.id))) return false;
    if (!isNonEmptyString(raw.title) && !isNonEmptyString(raw.original_title)) return false;
    return true;
  }

  static fromApi(raw) {
    return Movie.isValid(raw) ? new Movie(raw) : null;
  }

  /** Maps an array of raw TMDB movie objects to Movie instances (filters invalid) */
  static listFromApi(rawArray) {
    if (!Array.isArray(rawArray)) return [];
    return rawArray.map(Movie.fromApi).filter(Boolean);
  }
}

export default Movie;
