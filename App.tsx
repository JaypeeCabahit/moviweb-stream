import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import {
  BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation, useSearchParams,
} from 'react-router-dom';
import {
  Search, Home, Tv, Film, Star, Play, Plus, Check, LogIn, LogOut, User,
  Menu, X, ChevronLeft, ChevronRight, Info, Bookmark, Clock, TrendingUp,
  Award, Calendar, Flame, Zap, Settings, Globe, Heart, Eye,
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import * as tmdb from './services/tmdbService';
import { TMDB_IMAGE_BASE, TMDB_BACKDROP_BASE, TMDB_ORIGINAL_BASE, TMDB_LOGO_BASE, STREAM_PROVIDERS } from './config/constants';
import { LazyImage } from './components/LazyImage';
import {
  CardSkeleton, HeroSkeleton, DetailSkeleton, EpisodeSkeleton, GridSkeleton,
} from './components/LoadingSkeleton';
import type { Movie, Episode, SeasonDetail, WatchlistItem } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const posterUrl = (path: string | null | undefined) =>
  path ? `${TMDB_IMAGE_BASE}${path}` : '/placeholder-poster.jpg';
const backdropUrl = (path: string | null | undefined) =>
  path ? `${TMDB_BACKDROP_BASE}${path}` : '';
const originalUrl = (path: string | null | undefined) =>
  path ? `${TMDB_ORIGINAL_BASE}${path}` : '';
const logoUrl = (path: string | null | undefined) =>
  path ? `${TMDB_LOGO_BASE}${path}` : '';

const formatRating = (r: number) => r.toFixed(1);
const formatRuntime = (min: number) => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ─── Shared Components ────────────────────────────────────────────────────────

const RatingBadge = ({ rating }: { rating: number }) => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400">
    <Star className="w-3 h-3 fill-brand-400" />
    {formatRating(rating)}
  </span>
);

const MovieCard = ({
  item,
  onClick,
}: {
  item: Movie;
  onClick: (item: Movie) => void;
}) => {
  const title = tmdb.getTitle(item);
  const year = tmdb.getYear(item);
  const type = tmdb.getMediaType(item);

  return (
    <button
      onClick={() => onClick(item)}
      className="group flex-shrink-0 w-36 md:w-44 text-left rounded-xl overflow-hidden bg-[#141414] hover:bg-[#1e1e1e] transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-black/50 border border-white/5 hover:border-brand-500/30"
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <LazyImage
          src={posterUrl(item.poster_path)}
          alt={title}
          className="w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <RatingBadge rating={item.vote_average} />
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-black/60 text-gray-300">
            {type === 'tv' ? 'TV' : 'Film'}
          </span>
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shadow-lg">
            <Play className="w-4 h-4 text-black fill-black" />
          </div>
        </div>
      </div>
      <div className="p-2">
        <p className="text-white text-xs font-semibold truncate leading-tight">{title}</p>
        <p className="text-gray-500 text-xs mt-0.5">{year}</p>
      </div>
    </button>
  );
};

const MovieRow = ({
  title,
  icon,
  items,
  loading,
  onCardClick,
}: {
  title: string;
  icon?: React.ReactNode;
  items: Movie[];
  loading: boolean;
  onCardClick: (item: Movie) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' });
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4 px-4 md:px-6">
        <h2 className="flex items-center gap-2 text-white font-bold text-lg">
          {icon && <span className="text-brand-500">{icon}</span>}
          {title}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => scroll('left')} className="w-8 h-8 rounded-full bg-white/10 hover:bg-brand-500/20 flex items-center justify-center transition text-gray-400 hover:text-brand-400">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => scroll('right')} className="w-8 h-8 rounded-full bg-white/10 hover:bg-brand-500/20 flex items-center justify-center transition text-gray-400 hover:text-brand-400">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-6 pb-2">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
          : items.map(item => <MovieCard key={`${item.id}-${item.media_type}`} item={item} onClick={onCardClick} />)
        }
      </div>
    </section>
  );
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const MOVIE_GENRES = [
  { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' }, { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' }, { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' }, { id: 27, name: 'Horror' }, { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' }, { id: 10752, name: 'War' }, { id: 37, name: 'Western' },
];

const SidebarLink = ({
  label, icon, onClick, active,
}: {
  label: string; icon?: React.ReactNode; onClick: () => void; active?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-left ${
      active ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon && <span className={active ? 'text-brand-400' : ''}>{icon}</span>}
    {label}
  </button>
);

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const go = (path: string) => { navigate(path); onClose(); };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/70 z-[60] backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed top-0 left-0 h-full w-[280px] bg-[#111111] z-[70] transform transition-transform duration-300 ease-in-out border-r border-white/5 overflow-y-auto custom-scrollbar ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Link to="/home" onClick={onClose} className="flex items-center gap-2">
              <Film className="w-6 h-6 text-brand-500" />
              <span className="font-bold text-white text-lg">MoviWeb</span>
            </Link>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="space-y-1 mb-6">
            <SidebarLink label="Home" icon={<Home className="w-4 h-4" />} onClick={() => go('/home')} active={location.pathname === '/home'} />
            <SidebarLink label="Movies" icon={<Film className="w-4 h-4" />} onClick={() => go('/search?type=movie')} active={location.pathname === '/search' && location.search.includes('type=movie')} />
            <SidebarLink label="TV Shows" icon={<Tv className="w-4 h-4" />} onClick={() => go('/search?type=tv')} active={location.pathname === '/search' && location.search.includes('type=tv')} />
            <SidebarLink label="Trending" icon={<TrendingUp className="w-4 h-4" />} onClick={() => go('/discover/trending')} />
            <SidebarLink label="Top Rated" icon={<Award className="w-4 h-4" />} onClick={() => go('/discover/top-rated')} />
            <SidebarLink label="New Releases" icon={<Zap className="w-4 h-4" />} onClick={() => go('/discover/new')} />
            <SidebarLink label="About" icon={<Info className="w-4 h-4" />} onClick={() => go('/about')} active={location.pathname === '/about'} />
          </nav>

          <div className="h-px bg-white/5 mb-4" />

          {/* Genres */}
          <div>
            <h3 className="text-gray-500 font-bold text-xs mb-3 px-2 uppercase tracking-wider">Genres</h3>
            <div className="grid grid-cols-2 gap-0.5">
              {MOVIE_GENRES.map(g => (
                <button
                  key={g.id}
                  onClick={() => go(`/discover/genre/${g.id}?name=${encodeURIComponent(g.name)}`)}
                  className="text-left text-xs text-gray-400 hover:text-brand-400 px-2 py-2 rounded-lg transition truncate hover:bg-white/5"
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Navbar ───────────────────────────────────────────────────────────────────

const Navbar = ({ onMenuOpen }: { onMenuOpen: () => void }) => {
  const navigate = useNavigate();
  const { user, signInWithGoogle, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) { navigate(`/search?q=${encodeURIComponent(query.trim())}`); setQuery(''); }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5' : 'bg-gradient-to-b from-black/80 to-transparent'}`}>
      <div className="flex items-center gap-4 px-4 md:px-6 h-16">
        {/* Menu + Logo */}
        <button onClick={onMenuOpen} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition">
          <Menu className="w-5 h-5" />
        </button>

        <Link to="/home" className="flex items-center gap-2 font-bold text-xl text-white flex-shrink-0">
          <Film className="w-6 h-6 text-brand-500" />
          <span>MoviWeb</span>
        </Link>

        {/* Quick links */}
        <div className="hidden md:flex items-center gap-1 ml-2">
          <Link to="/home" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5">Home</Link>
          <Link to="/search?type=movie" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5">Movies</Link>
          <Link to="/search?type=tv" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5">TV Shows</Link>
          <Link to="/discover/trending" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5">Trending</Link>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-sm ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search movies, shows..."
              className="w-full bg-white/8 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 focus:bg-white/10 transition"
            />
          </div>
        </form>

        {/* User */}
        <div className="relative flex-shrink-0" ref={userMenuRef}>
          {user ? (
            <>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition"
              >
                {user.photoURL
                  ? <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full object-cover border-2 border-brand-500/50" />
                  : <div className="w-8 h-8 rounded-full bg-brand-500/20 border-2 border-brand-500/50 flex items-center justify-center"><User className="w-4 h-4 text-brand-400" /></div>
                }
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-white text-sm font-semibold truncate">{user.displayName}</p>
                    <p className="text-gray-500 text-xs truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <button onClick={() => { navigate('/profile'); setShowUserMenu(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition text-left">
                      <User className="w-4 h-4" /> My Profile
                    </button>
                    <button onClick={() => { navigate('/profile#watchlist'); setShowUserMenu(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition text-left">
                      <Bookmark className="w-4 h-4" /> My Watchlist
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition text-left">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-semibold text-sm transition"
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

// ─── Hero Carousel ────────────────────────────────────────────────────────────

const HeroCarousel = ({ items }: { items: Movie[] }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 6000, stopOnInteraction: false })]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [trailerData, setTrailerData] = useState<{ index: number; key: string } | null>(null);
  const [trailerReady, setTrailerReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      setSelectedIndex(idx);
      setTrailerData(null);
      setTrailerReady(false);
      // Resume auto-advance when user manually changes slide
      (emblaApi.plugins() as any)?.autoplay?.play?.();
    };
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  // Fetch trailer for the current slide
  useEffect(() => {
    if (!items.length) return;
    const item = items[selectedIndex];
    if (!item) return;
    const mediaType = tmdb.getMediaType(item);
    let cancelled = false;
    (async () => {
      const key = await tmdb.getTrailerKey(item.id, mediaType);
      if (!cancelled && key) setTrailerData({ index: selectedIndex, key });
    })();
    return () => { cancelled = true; };
  }, [selectedIndex, items]);

  // Pause auto-advance once trailer is playing
  useEffect(() => {
    if (!emblaApi || !trailerReady) return;
    (emblaApi.plugins() as any)?.autoplay?.stop?.();
  }, [trailerReady, emblaApi]);

  if (!items.length) return <HeroSkeleton />;

  const activeTrailerKey = trailerData?.index === selectedIndex ? trailerData.key : null;

  return (
    <div className="relative overflow-hidden" ref={emblaRef}>
      <div className="flex">
        {items.map((item, i) => {
          const title = tmdb.getTitle(item);
          const type = tmdb.getMediaType(item);
          const year = tmdb.getYear(item);
          const detailPath = `/${type}/${item.id}`;
          const isActive = i === selectedIndex;

          return (
            <div key={item.id} className="flex-[0_0_100%] relative h-[75vh] min-h-[500px]">
              {/* Backdrop image — hidden once trailer is ready */}
              {item.backdrop_path && (
                <img
                  src={backdropUrl(item.backdrop_path)}
                  alt={title}
                  className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-1000 ${isActive && trailerReady ? 'opacity-0' : 'opacity-100'}`}
                />
              )}

              {/* YouTube trailer iframe — only on active slide */}
              {isActive && activeTrailerKey && (
                <div
                  className={`absolute inset-0 overflow-hidden transition-opacity duration-1000 ${trailerReady ? 'opacity-100' : 'opacity-0'}`}
                  style={{ pointerEvents: 'none', background: '#000' }}
                >
                  <iframe
                    key={activeTrailerKey}
                    src={`https://www.youtube.com/embed/${activeTrailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&loop=1&playlist=${activeTrailerKey}&start=5&enablejsapi=1&origin=${window.location.origin}`}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    onLoad={() => setTrailerReady(true)}
                    title={`${title} trailer`}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      minWidth: '177.78vh',
                      minHeight: '56.25vw',
                      width: '100%',
                      height: '100vh',
                      transform: 'translate(-50%, -50%)',
                      border: 'none',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              )}

              {/* Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-black/30" />

              {/* Content */}
              <div className="absolute inset-0 flex items-end pb-16 px-6 md:px-12">
                <div className="max-w-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-wider">
                      {type === 'tv' ? 'TV Series' : 'Movie'}
                    </span>
                    {year && <span className="text-gray-400 text-sm">{year}</span>}
                    <RatingBadge rating={item.vote_average} />
                  </div>
                  <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-3 drop-shadow-lg">
                    {title}
                  </h1>
                  <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-6 line-clamp-3">
                    {item.overview}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate(detailPath)}
                      className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-bold text-sm transition btn-shimmer btn-shimmer-brand shadow-lg shadow-brand-500/30"
                    >
                      <Play className="w-4 h-4 fill-black" /> Watch Now
                    </button>
                    <button
                      onClick={() => navigate(detailPath)}
                      className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition border border-white/10"
                    >
                      <Info className="w-4 h-4" /> More Info
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`transition-all duration-300 rounded-full ${i === selectedIndex ? 'w-6 h-2 bg-brand-500' : 'w-2 h-2 bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Page: Landing ────────────────────────────────────────────────────────────

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#0a0a0a]">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-600/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_48px,rgba(255,255,255,0.01)_48px,rgba(255,255,255,0.01)_49px),repeating-linear-gradient(90deg,transparent,transparent_48px,rgba(255,255,255,0.01)_48px,rgba(255,255,255,0.01)_49px)]" />
      </div>

      <div className="relative z-10 text-center px-6 max-w-2xl">
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shadow-xl shadow-brand-500/10">
            <Film className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-5xl font-bold text-white">MoviWeb</h1>
        </div>

        <p className="text-gray-400 text-lg mb-2">Your cinematic universe, all in one place.</p>
        <p className="text-gray-600 text-sm mb-10">Stream thousands of movies and TV shows — no subscription required.</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/home')}
            className="px-8 py-4 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-bold text-lg transition shadow-xl shadow-brand-500/30 btn-shimmer btn-shimmer-brand"
          >
            Start Watching
          </button>
          <button
            onClick={() => navigate('/search')}
            className="px-8 py-4 rounded-full bg-white/8 hover:bg-white/15 text-white font-semibold text-lg transition border border-white/10"
          >
            Browse Library
          </button>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6 text-center">
          {[
            { icon: <Film className="w-6 h-6" />, label: 'Movies', sub: 'Thousands of titles' },
            { icon: <Tv className="w-6 h-6" />, label: 'TV Shows', sub: 'Full seasons' },
            { icon: <Zap className="w-6 h-6" />, label: 'Free', sub: 'No account needed' },
          ].map(item => (
            <div key={item.label} className="p-4 rounded-2xl bg-white/3 border border-white/5">
              <div className="text-brand-500 mb-2 flex justify-center">{item.icon}</div>
              <p className="text-white font-semibold text-sm">{item.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Page: Home ───────────────────────────────────────────────────────────────

const HomePage = () => {
  const navigate = useNavigate();
  const [heroItems, setHeroItems] = useState<Movie[]>([]);
  const [rows, setRows] = useState<Record<string, Movie[]>>({});
  const [loading, setLoading] = useState(true);

  const go = useCallback((item: Movie) => {
    const type = tmdb.getMediaType(item);
    navigate(`/${type}/${item.id}`);
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [trending, nowPlaying, topRated, popular, upcomingM, trendingTV, popularTV, topTV] = await Promise.all([
        tmdb.getTrendingMovies(),
        tmdb.getNowPlaying(),
        tmdb.getTopRatedMovies(),
        tmdb.getPopularMovies(),
        tmdb.getUpcoming(),
        tmdb.getTrendingTV(),
        tmdb.getPopularTV(),
        tmdb.getTopRatedTV(),
      ]);
      if (cancelled) return;
      setHeroItems((trending ?? []).slice(0, 6));
      setRows({
        trending: trending ?? [],
        nowPlaying: nowPlaying ?? [],
        topRated: topRated ?? [],
        popular: popular ?? [],
        upcoming: upcomingM ?? [],
        trendingTV: trendingTV ?? [],
        popularTV: popularTV ?? [],
        topTV: topTV ?? [],
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="pt-16">
        <HeroCarousel items={heroItems} />
      </div>

      <div className="py-8">
        <MovieRow title="Trending Movies" icon={<Flame className="w-5 h-5" />} items={rows.trending ?? []} loading={loading} onCardClick={go} />
        <MovieRow title="Now in Theaters" icon={<Film className="w-5 h-5" />} items={rows.nowPlaying ?? []} loading={loading} onCardClick={go} />
        <MovieRow title="Top Rated Movies" icon={<Award className="w-5 h-5" />} items={rows.topRated ?? []} loading={loading} onCardClick={go} />
        <MovieRow title="Trending TV Shows" icon={<TrendingUp className="w-5 h-5" />} items={rows.trendingTV ?? []} loading={loading} onCardClick={go} />
        <MovieRow title="Popular TV Shows" icon={<Tv className="w-5 h-5" />} items={rows.popularTV ?? []} loading={loading} onCardClick={go} />
        <MovieRow title="Popular Movies" icon={<Star className="w-5 h-5" />} items={rows.popular ?? []} loading={loading} onCardClick={go} />
        <MovieRow title="Top Rated TV" icon={<Award className="w-5 h-5" />} items={rows.topTV ?? []} loading={loading} onCardClick={go} />
        <MovieRow title="Coming Soon" icon={<Calendar className="w-5 h-5" />} items={rows.upcoming ?? []} loading={loading} onCardClick={go} />
      </div>
    </div>
  );
};

// ─── Watchlist Button ─────────────────────────────────────────────────────────

const WatchlistButton = ({
  id, mediaType, title, posterPath, rating,
}: {
  id: number; mediaType: 'movie' | 'tv'; title: string; posterPath: string | null; rating: number;
}) => {
  const { user, isInWatchlist, addToWatchlist, removeFromWatchlist } = useAuth();
  const inList = isInWatchlist(id, mediaType);

  const toggle = async () => {
    if (!user) return;
    if (inList) {
      await removeFromWatchlist(id, mediaType);
    } else {
      await addToWatchlist({
        id, mediaType, title, posterPath, rating,
        addedAt: Date.now(), status: 'plan_to_watch',
      });
    }
  };

  if (!user) return null;

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition border ${
        inList
          ? 'bg-brand-500/20 border-brand-500/50 text-brand-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400'
          : 'bg-white/8 border-white/10 text-white hover:bg-brand-500/10 hover:border-brand-500/30 hover:text-brand-400'
      }`}
    >
      {inList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      {inList ? 'In Watchlist' : 'Add to Watchlist'}
    </button>
  );
};

// ─── Page: Movie Detail ───────────────────────────────────────────────────────

const MovieDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [providerIdx, setProviderIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setPlaying(false);
    tmdb.getMovieDetails(Number(id)).then(m => { setMovie(m ?? null); setLoading(false); });
  }, [id]);

  if (loading) return <div className="pt-16"><DetailSkeleton /></div>;
  if (!movie) return (
    <div className="pt-16 min-h-screen flex items-center justify-center text-gray-400">
      <div className="text-center"><Film className="w-16 h-16 mx-auto mb-4 opacity-30" /><p>Movie not found</p></div>
    </div>
  );

  const title = tmdb.getTitle(movie);
  const year = tmdb.getYear(movie);
  const cast = movie.credits?.cast?.slice(0, 12) ?? [];
  const similar = movie.similar?.results?.slice(0, 15) ?? [];
  const trailer = movie.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const provider = STREAM_PROVIDERS[providerIdx];
  const streamUrl = provider.movieUrl(movie.id);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Backdrop */}
      <div className="relative h-[55vh] pt-16">
        {movie.backdrop_path && (
          <img src={originalUrl(movie.backdrop_path)} alt={title} className="absolute inset-0 w-full h-full object-cover object-top" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-32 relative z-10 pb-16">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="flex-shrink-0 w-44 md:w-56 mx-auto md:mx-0">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10">
              <LazyImage src={posterUrl(movie.poster_path)} alt={title} className="w-full aspect-[2/3]" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pt-2">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{title}</h1>

            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
              {year && <span className="px-2 py-0.5 rounded bg-white/8 text-gray-300">{year}</span>}
              {movie.runtime ? <span className="px-2 py-0.5 rounded bg-white/8 text-gray-300">{formatRuntime(movie.runtime)}</span> : null}
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-500/15 text-brand-400 font-semibold">
                <Star className="w-3.5 h-3.5 fill-brand-400" /> {formatRating(movie.vote_average)}
              </span>
              {movie.status && <span className="px-2 py-0.5 rounded bg-white/5 text-gray-400 text-xs">{movie.status}</span>}
            </div>

            {/* Genres */}
            {movie.genres && (
              <div className="flex flex-wrap gap-2 mb-4">
                {movie.genres.map(g => (
                  <span key={g.id} className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-300 hover:border-brand-500/30 hover:text-brand-400 transition cursor-pointer"
                    onClick={() => navigate(`/discover/genre/${g.id}?name=${encodeURIComponent(g.name)}`)}>
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {/* Tagline */}
            {movie.tagline && <p className="text-brand-400/80 italic text-sm mb-3">"{movie.tagline}"</p>}

            {/* Overview */}
            <p className="text-gray-300 text-sm leading-relaxed mb-6 max-w-2xl">{movie.overview}</p>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={() => setPlaying(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-bold text-sm transition btn-shimmer btn-shimmer-brand shadow-lg shadow-brand-500/20"
              >
                <Play className="w-4 h-4 fill-black" /> Play Movie
              </button>
              <WatchlistButton id={movie.id} mediaType="movie" title={title} posterPath={movie.poster_path} rating={movie.vote_average} />
              {trailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition bg-white/8 border border-white/10 text-white hover:bg-white/15"
                >
                  Trailer
                </a>
              )}
            </div>

            {/* Provider selector */}
            {playing && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-gray-500 text-xs">Source:</span>
                {STREAM_PROVIDERS.map((p, i) => (
                  <button key={p.key} onClick={() => setProviderIdx(i)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${i === providerIdx ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Player */}
        {playing && (
          <div className="mt-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/80 bg-black">
            <div className="flex items-center justify-between px-4 py-2 bg-[#141414] border-b border-white/5">
              <span className="text-white text-sm font-semibold">{title}</span>
              <button onClick={() => setPlaying(false)} className="text-gray-400 hover:text-white transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={streamUrl}
                className="absolute inset-0 w-full h-full"
                allowFullScreen
                allow="fullscreen; autoplay"
                title={title}
              />
            </div>
          </div>
        )}

        {/* Cast */}
        {cast.length > 0 && (
          <section className="mt-10">
            <h2 className="text-white font-bold text-xl mb-4">Cast</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {cast.map(c => (
                <div key={c.id} className="flex-shrink-0 w-24 text-center">
                  <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-2 bg-[#1e1e1e] border border-white/10">
                    <LazyImage src={c.profile_path ? `${TMDB_IMAGE_BASE}${c.profile_path}` : ''} alt={c.name} className="w-full h-full" />
                  </div>
                  <p className="text-white text-xs font-medium truncate">{c.name}</p>
                  <p className="text-gray-500 text-xs truncate">{c.character}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Similar */}
        {similar.length > 0 && (
          <section className="mt-10">
            <MovieRow
              title="More Like This"
              items={similar}
              loading={false}
              onCardClick={(item) => navigate(`/movie/${item.id}`)}
            />
          </section>
        )}
      </div>
    </div>
  );
};

// ─── Page: TV Detail ──────────────────────────────────────────────────────────

const TVDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [show, setShow] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonData, setSeasonData] = useState<SeasonDetail | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [providerIdx, setProviderIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setPlaying(false);
    setSelectedEp(null);
    tmdb.getTVDetails(Number(id)).then(s => {
      setShow(s ?? null);
      setLoading(false);
      if (s?.seasons) {
        const first = s.seasons.find(season => season.season_number > 0)?.season_number ?? 1;
        setSelectedSeason(first);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!id || !selectedSeason) return;
    setSeasonLoading(true);
    tmdb.getTVSeason(Number(id), selectedSeason).then(s => {
      setSeasonData(s ?? null);
      setSeasonLoading(false);
    });
  }, [id, selectedSeason]);

  if (loading) return <div className="pt-16"><DetailSkeleton /></div>;
  if (!show) return (
    <div className="pt-16 min-h-screen flex items-center justify-center text-gray-400">
      <div className="text-center"><Tv className="w-16 h-16 mx-auto mb-4 opacity-30" /><p>Show not found</p></div>
    </div>
  );

  const title = tmdb.getTitle(show);
  const year = tmdb.getYear(show);
  const cast = show.credits?.cast?.slice(0, 12) ?? [];
  const similar = show.similar?.results?.slice(0, 15) ?? [];
  const trailer = show.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const seasons = show.seasons?.filter(s => s.season_number > 0) ?? [];
  const provider = STREAM_PROVIDERS[providerIdx];
  const streamUrl = selectedEp
    ? provider.tvUrl(show.id, selectedEp.season_number, selectedEp.episode_number)
    : provider.tvUrl(show.id, selectedSeason, 1);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Backdrop */}
      <div className="relative h-[55vh] pt-16">
        {show.backdrop_path && (
          <img src={originalUrl(show.backdrop_path)} alt={title} className="absolute inset-0 w-full h-full object-cover object-top" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-32 relative z-10 pb-16">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-shrink-0 w-44 md:w-56 mx-auto md:mx-0">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10">
              <LazyImage src={posterUrl(show.poster_path)} alt={title} className="w-full aspect-[2/3]" />
            </div>
          </div>

          <div className="flex-1 pt-2">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{title}</h1>
            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
              {year && <span className="px-2 py-0.5 rounded bg-white/8 text-gray-300">{year}</span>}
              {show.number_of_seasons && <span className="px-2 py-0.5 rounded bg-white/8 text-gray-300">{show.number_of_seasons} Season{show.number_of_seasons > 1 ? 's' : ''}</span>}
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-500/15 text-brand-400 font-semibold">
                <Star className="w-3.5 h-3.5 fill-brand-400" /> {formatRating(show.vote_average)}
              </span>
              {show.status && <span className="px-2 py-0.5 rounded bg-white/5 text-gray-400 text-xs">{show.status}</span>}
            </div>
            {show.genres && (
              <div className="flex flex-wrap gap-2 mb-4">
                {show.genres.map(g => (
                  <span key={g.id} className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-300">
                    {g.name}
                  </span>
                ))}
              </div>
            )}
            <p className="text-gray-300 text-sm leading-relaxed mb-6 max-w-2xl">{show.overview}</p>
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={() => { setPlaying(true); if (!selectedEp && seasonData?.episodes?.[0]) setSelectedEp(seasonData.episodes[0]); }}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-bold text-sm transition btn-shimmer btn-shimmer-brand shadow-lg shadow-brand-500/20"
              >
                <Play className="w-4 h-4 fill-black" /> Play
              </button>
              <WatchlistButton id={show.id} mediaType="tv" title={title} posterPath={show.poster_path} rating={show.vote_average} />
              {trailer && (
                <a href={`https://www.youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition bg-white/8 border border-white/10 text-white hover:bg-white/15">
                  Trailer
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Player */}
        {playing && (
          <div className="mt-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/80 bg-black">
            <div className="flex items-center justify-between px-4 py-2 bg-[#141414] border-b border-white/5">
              <span className="text-white text-sm font-semibold">
                {title} {selectedEp ? `— S${selectedEp.season_number}E${selectedEp.episode_number}: ${selectedEp.name}` : ''}
              </span>
              <div className="flex items-center gap-3">
                {STREAM_PROVIDERS.map((p, i) => (
                  <button key={p.key} onClick={() => setProviderIdx(i)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition ${i === providerIdx ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-white'}`}>
                    {p.label}
                  </button>
                ))}
                <button onClick={() => setPlaying(false)} className="text-gray-400 hover:text-white transition ml-2"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe src={streamUrl} className="absolute inset-0 w-full h-full" allowFullScreen allow="fullscreen; autoplay" title={title} />
            </div>
          </div>
        )}

        {/* Season/Episode selector */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Episodes</h2>
            {seasons.length > 0 && (
              <select
                value={selectedSeason}
                onChange={e => { setSelectedSeason(Number(e.target.value)); setSelectedEp(null); }}
                className="bg-[#1a1a1a] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500/50"
              >
                {seasons.map(s => (
                  <option key={s.season_number} value={s.season_number}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          {seasonLoading ? <EpisodeSkeleton /> : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
              {(seasonData?.episodes ?? []).map(ep => {
                const isActive = selectedEp?.episode_number === ep.episode_number && playing;
                return (
                  <button
                    key={ep.id}
                    onClick={() => { setSelectedEp(ep); setPlaying(true); }}
                    className={`w-full flex gap-3 p-3 rounded-xl text-left transition border ${
                      isActive
                        ? 'bg-brand-500/10 border-brand-500/40'
                        : 'bg-[#141414] border-white/5 hover:bg-[#1a1a1a] hover:border-white/10'
                    }`}
                  >
                    <div className="relative flex-shrink-0 w-28 h-16 rounded-lg overflow-hidden bg-[#1e1e1e]">
                      {ep.still_path ? (
                        <img src={`${TMDB_IMAGE_BASE}${ep.still_path}`} alt={ep.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Play className="w-6 h-6 text-gray-600" /></div>
                      )}
                      {isActive && (
                        <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                            <Play className="w-4 h-4 text-black fill-black" />
                          </div>
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 text-xs font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                        E{ep.episode_number}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isActive ? 'text-brand-400' : 'text-white'}`}>
                        {ep.name}
                      </p>
                      {ep.overview && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{ep.overview}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {ep.runtime && <span className="text-gray-600 text-xs">{ep.runtime}m</span>}
                        {ep.air_date && <span className="text-gray-600 text-xs">{ep.air_date}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cast */}
        {cast.length > 0 && (
          <section className="mt-10">
            <h2 className="text-white font-bold text-xl mb-4">Cast</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {cast.map(c => (
                <div key={c.id} className="flex-shrink-0 w-24 text-center">
                  <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-2 bg-[#1e1e1e] border border-white/10">
                    <LazyImage src={c.profile_path ? `${TMDB_IMAGE_BASE}${c.profile_path}` : ''} alt={c.name} className="w-full h-full" />
                  </div>
                  <p className="text-white text-xs font-medium truncate">{c.name}</p>
                  <p className="text-gray-500 text-xs truncate">{c.character}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-10">
            <MovieRow title="More Like This" items={similar} loading={false} onCardClick={(item) => navigate(`/tv/${item.id}`)} />
          </section>
        )}
      </div>
    </div>
  );
};

// ─── Page: Search ─────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const typeFilter = searchParams.get('type') ?? 'all';
  const page = Number(searchParams.get('page') ?? '1');

  const [results, setResults] = useState<Movie[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [inputVal, setInputVal] = useState(query);

  useEffect(() => { setInputVal(query); }, [query]);

  useEffect(() => {
    if (!query && typeFilter === 'all') {
      // Show trending when no query
      setLoading(true);
      Promise.all([tmdb.getTrendingMovies(), tmdb.getTrendingTV()]).then(([movies, tv]) => {
        setResults([...(movies ?? []), ...(tv ?? [])]);
        setTotalPages(1);
        setLoading(false);
      });
      return;
    }

    setLoading(true);
    const doSearch = async () => {
      if (!query) {
        // Browse mode
        if (typeFilter === 'movie') {
          const d = await tmdb.discoverMovies({ sort_by: 'popularity.desc' }, page);
          setResults(d.results); setTotalPages(d.total_pages);
        } else if (typeFilter === 'tv') {
          const d = await tmdb.discoverTV({ sort_by: 'popularity.desc' }, page);
          setResults(d.results); setTotalPages(d.total_pages);
        }
        setLoading(false);
        return;
      }

      if (typeFilter === 'movie') {
        const d = await tmdb.searchMovies(query, page);
        setResults(d.results); setTotalPages(d.total_pages);
      } else if (typeFilter === 'tv') {
        const d = await tmdb.searchTV(query, page);
        setResults(d.results); setTotalPages(d.total_pages);
      } else {
        const d = await tmdb.searchMulti(query, page);
        setResults(d.results.filter(r => r.media_type !== 'person'));
        setTotalPages(d.total_pages);
      }
      setLoading(false);
    };
    doSearch();
  }, [query, typeFilter, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: inputVal.trim(), type: typeFilter, page: '1' });
  };

  const goCard = (item: Movie) => {
    const type = tmdb.getMediaType(item);
    navigate(`/${type}/${item.id}`);
  };

  const pageNums = useMemo(() => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); return pages; }
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-16 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-6 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Search movies, TV shows..."
              className="w-full bg-[#141414] border border-white/10 rounded-full pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 transition text-sm"
            />
          </div>
          <button type="submit" className="px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-bold text-sm transition">
            Search
          </button>
        </form>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'movie', 'tv'] as const).map(t => (
            <button key={t} onClick={() => setSearchParams({ q: query, type: t, page: '1' })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${typeFilter === t ? 'bg-brand-500 text-black' : 'bg-white/8 text-gray-400 hover:text-white border border-white/10'}`}>
              {t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'TV Shows'}
            </button>
          ))}
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-white font-bold text-2xl">
            {query ? `Results for "${query}"` : typeFilter === 'movie' ? 'Popular Movies' : typeFilter === 'tv' ? 'Popular TV Shows' : 'Trending Now'}
          </h1>
          {!loading && <p className="text-gray-500 text-sm mt-1">{results.length} titles</p>}
        </div>

        {/* Grid */}
        {loading ? <GridSkeleton count={20} /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map(item => (
              <MovieCard key={`${item.id}-${item.media_type}`} item={item} onClick={goCard} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-10">
            <button onClick={() => setSearchParams({ q: query, type: typeFilter, page: String(page - 1) })} disabled={page === 1}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="w-5 h-5" />
            </button>
            {pageNums.map((p, i) => (
              <button key={i} onClick={() => typeof p === 'number' && setSearchParams({ q: query, type: typeFilter, page: String(p) })}
                disabled={p === '...'}
                className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-bold transition ${
                  p === page ? 'bg-brand-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : typeof p === 'number' ? 'bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 cursor-default'
                }`}>
                {p}
              </button>
            ))}
            <button onClick={() => setSearchParams({ q: query, type: typeFilter, page: String(page + 1) })} disabled={page === totalPages}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Page: Discover ───────────────────────────────────────────────────────────

const DiscoverPage = () => {
  const { category } = useParams<{ category: string }>();
  const [searchParams] = useSearchParams();
  const genreName = searchParams.get('name') ?? '';
  const navigate = useNavigate();
  const [items, setItems] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const title = useMemo(() => {
    if (category === 'trending') return 'Trending Now';
    if (category === 'top-rated') return 'Top Rated';
    if (category === 'new') return 'New Releases';
    if (category?.startsWith('genre/')) return genreName || 'Genre';
    return category ?? 'Discover';
  }, [category, genreName]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    const load = async () => {
      let results: Movie[] = [], tp = 1;
      if (category === 'trending') {
        const [m, tv] = await Promise.all([tmdb.getTrendingMovies(), tmdb.getTrendingTV()]);
        results = [...(m ?? []), ...(tv ?? [])];
      } else if (category === 'top-rated') {
        const [m, tv] = await Promise.all([tmdb.getTopRatedMovies(), tmdb.getTopRatedTV()]);
        results = [...(m ?? []), ...(tv ?? [])];
      } else if (category === 'new') {
        const [m, tv] = await Promise.all([tmdb.getNowPlaying(), tmdb.getAiringToday()]);
        results = [...(m ?? []), ...(tv ?? [])];
      } else if (category?.startsWith('genre/')) {
        const genreId = category.replace('genre/', '');
        const d = await tmdb.discoverMovies({ with_genres: genreId, sort_by: 'popularity.desc' }, 1);
        results = d.results; tp = d.total_pages;
      }
      setItems(results);
      setTotalPages(tp);
      setLoading(false);
    };
    load();
  }, [category]);

  const goCard = (item: Movie) => { const type = tmdb.getMediaType(item); navigate(`/${type}/${item.id}`); };

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-16 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
        <p className="text-gray-500 text-sm mb-8">{items.length} titles</p>
        {loading ? <GridSkeleton count={20} /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map(item => <MovieCard key={`${item.id}-${item.media_type}`} item={item} onClick={goCard} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Page: Profile ────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const { user, signInWithGoogle, logout, watchlist, removeFromWatchlist, updateWatchlistItem } = useAuth();
  const navigate = useNavigate();

  if (!user) return (
    <div className="min-h-screen bg-[#0a0a0a] pt-24 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-6">
          <User className="w-10 h-10 text-brand-400" />
        </div>
        <h2 className="text-white font-bold text-2xl mb-2">Sign in to track your watchlist</h2>
        <p className="text-gray-500 text-sm mb-6">Save movies and shows to watch later, track what you've seen, and more.</p>
        <button onClick={signInWithGoogle} className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-bold text-sm transition mx-auto">
          <LogIn className="w-4 h-4" /> Sign in with Google
        </button>
      </div>
    </div>
  );

  const statuses: WatchlistItem['status'][] = ['watching', 'completed', 'plan_to_watch', 'dropped'];
  const statusLabels: Record<WatchlistItem['status'], string> = {
    watching: 'Watching',
    completed: 'Completed',
    plan_to_watch: 'Plan to Watch',
    dropped: 'Dropped',
  };
  const statusColors: Record<WatchlistItem['status'], string> = {
    watching: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    plan_to_watch: 'bg-brand-500/20 text-brand-400',
    dropped: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-16 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-10 p-6 rounded-2xl bg-[#111111] border border-white/5">
          {user.photoURL
            ? <img src={user.photoURL} alt="avatar" className="w-20 h-20 rounded-full border-2 border-brand-500/50 object-cover" />
            : <div className="w-20 h-20 rounded-full bg-brand-500/20 border-2 border-brand-500/50 flex items-center justify-center"><User className="w-10 h-10 text-brand-400" /></div>
          }
          <div>
            <h1 className="text-white font-bold text-2xl">{user.displayName}</h1>
            <p className="text-gray-500 text-sm">{user.email}</p>
            <div className="flex gap-4 mt-2">
              <span className="text-gray-400 text-sm"><span className="text-white font-bold">{watchlist.length}</span> in watchlist</span>
              <span className="text-gray-400 text-sm"><span className="text-white font-bold">{watchlist.filter(w => w.status === 'completed').length}</span> completed</span>
            </div>
          </div>
          <button onClick={logout} className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/5 text-sm transition border border-white/5">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* Watchlist */}
        <div id="watchlist">
          <h2 className="text-white font-bold text-xl mb-6">My Watchlist</h2>
          {watchlist.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Your watchlist is empty.</p>
              <button onClick={() => navigate('/home')} className="mt-4 px-6 py-2 rounded-full bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition text-sm font-medium">
                Browse Movies & Shows
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {watchlist.map(item => (
                <div key={`${item.mediaType}-${item.id}`} className="flex gap-4 p-3 rounded-xl bg-[#111111] border border-white/5 hover:border-white/10 transition">
                  <button onClick={() => navigate(`/${item.mediaType}/${item.id}`)} className="flex-shrink-0 w-16 aspect-[2/3] rounded-lg overflow-hidden bg-[#1e1e1e]">
                    <LazyImage src={posterUrl(item.posterPath)} alt={item.title} className="w-full h-full" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate(`/${item.mediaType}/${item.id}`)} className="text-white font-semibold text-sm hover:text-brand-400 transition truncate block text-left">
                      {item.title}
                    </button>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 uppercase">{item.mediaType}</span>
                      <RatingBadge rating={item.rating} />
                    </div>
                    <select
                      value={item.status}
                      onChange={e => updateWatchlistItem(item.id, item.mediaType, { status: e.target.value as WatchlistItem['status'] })}
                      className={`mt-2 text-xs font-medium px-2 py-1 rounded-full bg-transparent border cursor-pointer focus:outline-none ${statusColors[item.status]} border-current/30`}
                    >
                      {statuses.map(s => <option key={s} value={s} className="bg-[#1a1a1a] text-white">{statusLabels[s]}</option>)}
                    </select>
                  </div>
                  <button onClick={() => removeFromWatchlist(item.id, item.mediaType)} className="self-start p-1.5 text-gray-600 hover:text-red-400 transition rounded-lg hover:bg-red-500/5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Page: About ─────────────────────────────────────────────────────────────

const AboutPage = () => (
  <div className="min-h-screen bg-[#0a0a0a] pb-16">
    {/* Hero */}
    <div className="relative py-20 px-4 text-center overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-500/8 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="relative z-10 max-w-2xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 text-xs text-brand-400 font-bold uppercase tracking-widest mb-6">
          About This Project
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
          Movi<span className="text-brand-500">Web</span>
        </h1>
        <p className="text-gray-400 text-base leading-relaxed">
          A free, open movie &amp; TV streaming platform — no ads, no subscriptions, built with love.
        </p>
      </div>
    </div>

    <div className="max-w-3xl mx-auto px-4 py-16 space-y-14">
      {/* Creator */}
      <section className="text-center">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.3em] mb-8">Created By</h2>
        <div className="inline-flex flex-col items-center gap-4 bg-[#141414] border border-white/5 rounded-2xl px-12 py-10 shadow-2xl">
          <img
            src="/JaypeeProfile.jpg"
            alt="Jaypee"
            className="w-24 h-24 rounded-full object-cover shadow-xl shadow-brand-500/20 border-2 border-brand-500/40"
          />
          <div>
            <h3 className="text-2xl font-black text-white">Jaypee</h3>
            <p className="text-brand-400 text-sm font-bold mt-1">Web Developer &amp; Designer</p>
          </div>
          <p className="text-gray-400 text-sm text-center max-w-sm leading-relaxed">
            I created this so I can watch movies and shows ads free teehee!
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 border border-white/5 rounded-full px-4 py-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400" /> dpodevmail@gmail.com
          </div>
        </div>
      </section>

      {/* Contributors */}
      <section className="text-center">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.3em] mb-8">Contributors</h2>
        <div className="inline-flex flex-col items-center gap-4 bg-[#141414] border border-white/5 rounded-2xl px-12 py-10 shadow-2xl">
          <div className="w-24 h-24 rounded-full bg-brand-500/20 border-2 border-brand-500/40 flex items-center justify-center text-3xl font-black text-brand-400">
            LM
          </div>
          <div>
            <h3 className="text-2xl font-black text-white">Lexus Mancera</h3>
            <p className="text-brand-400 text-sm font-bold mt-1">Web Developer &amp; Bug Hunter</p>
          </div>
          <p className="text-gray-400 text-sm text-center max-w-sm leading-relaxed">
            Dev partner, idea guy, and resident bug hunter. Helps shape the direction of MoviWeb by finding issues, suggesting features, and keeping things honest.
          </p>
        </div>
      </section>

      {/* Tech stack */}
      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.3em] mb-6 text-center">Built With</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { name: 'React 19', desc: 'UI Framework' },
            { name: 'TypeScript', desc: 'Type Safety' },
            { name: 'Tailwind CSS', desc: 'Styling' },
            { name: 'TMDB API', desc: 'Movie & TV Data' },
            { name: 'Firebase', desc: 'Auth & Watchlist' },
            { name: 'Videasy', desc: 'Streaming Player' },
          ].map(t => (
            <div key={t.name} className="bg-[#141414] border border-white/5 rounded-xl p-4 text-center hover:border-brand-500/20 transition">
              <p className="text-white font-bold text-sm">{t.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="bg-[#141414] border border-white/5 rounded-xl p-6 text-sm text-gray-400 leading-relaxed text-center">
        <p className="font-bold text-white mb-2">Disclaimer</p>
        MoviWeb does not host any media files. All content is sourced from third-party providers for personal, non-commercial use. Movie titles, characters, and related media are property of their respective owners.
      </section>
    </div>
  </div>
);

// ─── App Shell ────────────────────────────────────────────────────────────────

const AppContent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/movie/:id" element={<MovieDetailPage />} />
        <Route path="/tv/:id" element={<TVDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/discover/:category" element={<DiscoverPage />} />
        <Route path="/discover/:category/:sub" element={<DiscoverPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={
          <div className="pt-24 min-h-screen flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-6xl font-bold text-white/10 mb-4">404</p>
              <p className="mb-4">Page not found</p>
              <Link to="/home" className="text-brand-400 hover:text-brand-300 transition">Go Home</Link>
            </div>
          </div>
        } />
      </Routes>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
