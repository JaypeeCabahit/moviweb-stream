export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string;
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
export const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
export const TMDB_ORIGINAL_BASE = 'https://image.tmdb.org/t/p/original';
export const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w300';

export const STREAM_PROVIDERS = [
  {
    key: 'videasy',
    label: 'Videasy',
    movieUrl: (id: number) => `https://player.videasy.net/movie/${id}`,
    tvUrl: (id: number, season: number, episode: number) =>
      `https://player.videasy.net/tv/${id}/${season}/${episode}`,
  },
  {
    key: 'vidsrc',
    label: 'VidSrc',
    movieUrl: (id: number) => `https://vidsrc.to/embed/movie/${id}`,
    tvUrl: (id: number, season: number, episode: number) =>
      `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`,
  },
  {
    key: 'embed',
    label: 'Embed.su',
    movieUrl: (id: number) => `https://embed.su/embed/movie/${id}`,
    tvUrl: (id: number, season: number, episode: number) =>
      `https://embed.su/embed/tv/${id}/${season}/${episode}`,
  },
];

export const PLACEHOLDER_POSTER = 'https://via.placeholder.com/300x450/141414/f59e0b?text=No+Image';
export const PLACEHOLDER_BACKDROP = 'https://via.placeholder.com/1280x720/0a0a0a/f59e0b?text=No+Backdrop';
