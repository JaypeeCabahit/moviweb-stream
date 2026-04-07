import { TMDB_API_KEY, TMDB_BASE_URL } from '../config/constants';
import { cachedFetch } from './cacheService';
import type { Movie, SeasonDetail } from '../types';

// In-flight dedup
const inFlight = new Map<string, Promise<any>>();

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!TMDB_API_KEY) { console.error('VITE_TMDB_API_KEY is not set'); return null; }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const cacheKey = url.toString();
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const promise = (async () => {
    try {
      const res = await fetch(cacheKey);
      if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.statusText}`);
      return await res.json() as T;
    } catch (err) {
      console.error('TMDB fetch error:', err);
      return null;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}

// ─── Home page rows ───────────────────────────────────────────────────────────

export const getTrendingMovies = () =>
  cachedFetch('trending-movies', () =>
    fetchTMDB<{ results: Movie[] }>('/trending/movie/week').then(d => d?.results ?? []), 'home');

export const getTrendingTV = () =>
  cachedFetch('trending-tv', () =>
    fetchTMDB<{ results: Movie[] }>('/trending/tv/week').then(d => d?.results ?? []), 'home');

export const getNowPlaying = () =>
  cachedFetch('now-playing', () =>
    fetchTMDB<{ results: Movie[] }>('/movie/now_playing').then(d => d?.results ?? []), 'home');

export const getTopRatedMovies = () =>
  cachedFetch('top-rated-movies', () =>
    fetchTMDB<{ results: Movie[] }>('/movie/top_rated').then(d => d?.results ?? []), 'home');

export const getPopularMovies = () =>
  cachedFetch('popular-movies', () =>
    fetchTMDB<{ results: Movie[] }>('/movie/popular').then(d => d?.results ?? []), 'home');

export const getUpcoming = () =>
  cachedFetch('upcoming-movies', () =>
    fetchTMDB<{ results: Movie[] }>('/movie/upcoming').then(d => d?.results ?? []), 'home');

export const getPopularTV = () =>
  cachedFetch('popular-tv', () =>
    fetchTMDB<{ results: Movie[] }>('/tv/popular').then(d => d?.results ?? []), 'home');

export const getTopRatedTV = () =>
  cachedFetch('top-rated-tv', () =>
    fetchTMDB<{ results: Movie[] }>('/tv/top_rated').then(d => d?.results ?? []), 'home');

export const getAiringToday = () =>
  cachedFetch('airing-today', () =>
    fetchTMDB<{ results: Movie[] }>('/tv/airing_today').then(d => d?.results ?? []), 'home');

// ─── Detail pages ─────────────────────────────────────────────────────────────

export const getMovieDetails = (id: number) =>
  cachedFetch(`movie-${id}`, () =>
    fetchTMDB<Movie>(`/movie/${id}`, {
      append_to_response: 'credits,videos,similar,images,belongs_to_collection',
    }), 'movie');

export const getTVDetails = (id: number) =>
  cachedFetch(`tv-${id}`, () =>
    fetchTMDB<Movie>(`/tv/${id}`, {
      append_to_response: 'credits,videos,similar,images,external_ids',
    }), 'movie');

export const getTVSeason = (tvId: number, season: number) =>
  cachedFetch(`tv-${tvId}-s${season}`, () =>
    fetchTMDB<SeasonDetail>(`/tv/${tvId}/season/${season}`), 'movie');

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchMulti = async (query: string, page = 1): Promise<{ results: Movie[]; total_pages: number; total_results: number }> => {
  if (!query.trim()) return { results: [], total_pages: 0, total_results: 0 };
  const data = await cachedFetch(`search-${query}-${page}`, () =>
    fetchTMDB<{ results: Movie[]; total_pages: number; total_results: number }>('/search/multi', { query, page: String(page) }), 'search');
  return data ?? { results: [], total_pages: 0, total_results: 0 };
};

export const searchMovies = async (query: string, page = 1): Promise<{ results: Movie[]; total_pages: number }> => {
  if (!query.trim()) return { results: [], total_pages: 0 };
  const data = await cachedFetch(`search-movies-${query}-${page}`, () =>
    fetchTMDB<{ results: Movie[]; total_pages: number }>('/search/movie', { query, page: String(page) }), 'search');
  return data ?? { results: [], total_pages: 0 };
};

export const searchTV = async (query: string, page = 1): Promise<{ results: Movie[]; total_pages: number }> => {
  if (!query.trim()) return { results: [], total_pages: 0 };
  const data = await cachedFetch(`search-tv-${query}-${page}`, () =>
    fetchTMDB<{ results: Movie[]; total_pages: number }>('/search/tv', { query, page: String(page) }), 'search');
  return data ?? { results: [], total_pages: 0 };
};

// ─── Discover ─────────────────────────────────────────────────────────────────

export const discoverMovies = async (params: Record<string, string>, page = 1) => {
  const key = `discover-movies-${JSON.stringify(params)}-${page}`;
  const data = await cachedFetch(key, () =>
    fetchTMDB<{ results: Movie[]; total_pages: number }>('/discover/movie', { ...params, page: String(page) }), 'home');
  return data ?? { results: [], total_pages: 0 };
};

export const discoverTV = async (params: Record<string, string>, page = 1) => {
  const key = `discover-tv-${JSON.stringify(params)}-${page}`;
  const data = await cachedFetch(key, () =>
    fetchTMDB<{ results: Movie[]; total_pages: number }>('/discover/tv', { ...params, page: String(page) }), 'home');
  return data ?? { results: [], total_pages: 0 };
};

// ─── Trailers ─────────────────────────────────────────────────────────────────

export const getTrailerKey = async (id: number, mediaType: 'movie' | 'tv'): Promise<string | null> => {
  const endpoint = mediaType === 'movie' ? `/movie/${id}/videos` : `/tv/${id}/videos`;
  const data = await cachedFetch(`videos-${mediaType}-${id}`, () =>
    fetchTMDB<{ results: { key: string; site: string; type: string }[] }>(endpoint), 'movie');
  const trailer = data?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer');
  return trailer?.key ?? null;
};

// ─── Genres ───────────────────────────────────────────────────────────────────

export const getMovieGenres = () =>
  cachedFetch('movie-genres', () =>
    fetchTMDB<{ genres: { id: number; name: string }[] }>('/genre/movie/list').then(d => d?.genres ?? []), 'home');

export const getTVGenres = () =>
  cachedFetch('tv-genres', () =>
    fetchTMDB<{ genres: { id: number; name: string }[] }>('/genre/tv/list').then(d => d?.genres ?? []), 'home');

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const getTitle = (item: Movie) => item.title || item.name || 'Unknown';
export const getYear = (item: Movie) =>
  (item.release_date || item.first_air_date || '').slice(0, 4);
export const getMediaType = (item: Movie): 'movie' | 'tv' =>
  item.media_type === 'tv' || (!item.title && !!item.name) ? 'tv' : 'movie';
