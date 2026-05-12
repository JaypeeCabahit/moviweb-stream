import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import {
  BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation, useSearchParams,
} from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import {
  Search, Home, Tv, Film, Star, Play, Plus, Check, LogIn, LogOut, User,
  Menu, X, ChevronLeft, ChevronRight, Info, Bookmark, Clock, TrendingUp,
  Award, Calendar, Flame, Zap, Settings, Globe, Heart, Eye, EyeOff,
  Mail, Lock, AlertCircle, Database, Loader2, ShieldCheck, Download,
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { auth } from './services/firebase';
import * as tmdb from './services/tmdbService';
import { getMovieStream, getTVStream } from './services/movieStreamService';
import type { ScrapedStream } from './services/movieStreamService';
import {
  deleteOfflineVideo,
  getOfflineVideo,
  listOfflineVideos,
  saveOfflineVideoFromFile,
  saveOfflineVideoFromUrl,
  type OfflineVideoItem,
} from './services/offlineLibrary';
import { TMDB_IMAGE_BASE, TMDB_BACKDROP_BASE, TMDB_ORIGINAL_BASE, TMDB_LOGO_BASE, STREAM_PROVIDERS } from './config/constants';
import { LazyImage } from './components/LazyImage';
import {
  CardSkeleton, HeroSkeleton, DetailSkeleton, EpisodeSkeleton, GridSkeleton,
} from './components/LoadingSkeleton';
import type { Movie, Episode, SeasonDetail, WatchHistoryItem, WatchlistItem } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const posterUrl = (path: string | null | undefined) =>
  path ? `${TMDB_IMAGE_BASE}${path}` : '/placeholder-poster.jpg';
const backdropUrl = (path: string | null | undefined) =>
  path ? `${TMDB_BACKDROP_BASE}${path}` : '';
const originalUrl = (path: string | null | undefined) =>
  path ? `${TMDB_ORIGINAL_BASE}${path}` : '';
const logoUrl = (path: string | null | undefined) =>
  path ? `${TMDB_LOGO_BASE}${path}` : '';

const formatRating = (r: number) => (r ?? 0).toFixed(1);
const formatRuntime = (min: number) => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const formatBytes = (bytes: number) => {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i < 2 ? 0 : 1)} ${units[i]}`;
};

const getAuthErrorMessage = (err: unknown) => {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'That email already has an account.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Use at least 6 characters for your password.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/expired-action-code': 'This reset link has expired. Request a new one.',
    'auth/invalid-action-code': 'This reset link is invalid or already used.',
  };
  return messages[code] ?? (err instanceof Error ? err.message : 'Something went wrong. Try again.');
};

const getUserDisplayName = (user: { displayName?: string | null; email?: string | null }) =>
  user.displayName || user.email || 'MoviWeb User';

const getUserAvatar = (user: { photoURL?: string | null; displayName?: string | null; email?: string | null }) =>
  user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email || user.displayName || 'MoviWeb')}`;

// ─── Shared Components ────────────────────────────────────────────────────────

const RatingBadge = ({ rating }: { rating: number }) => {
  if (!rating) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400">
      <Star className="w-3 h-3 fill-brand-400" />
      {formatRating(rating)}
    </span>
  );
};

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
                  onClick={() => go(`/discover/genre/${g.id}?name=${encodeURIComponent(g.name)}&type=movie`)}
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

const AuthPanel = () => {
  const navigate = useNavigate();
  const {
    user, firebaseReady, signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword,
  } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signup') {
        await signUpWithEmail(displayName, email, password);
      } else {
        await signInWithEmail(email, password);
      }
      navigate('/profile');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await resetPassword(email);
      setNotice('Password reset email sent.');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await signInWithGoogle();
      navigate('/profile');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="w-full max-w-md mx-auto rounded-2xl bg-[#111111] border border-white/10 p-5 sm:p-6 text-center">
        <img src={getUserAvatar(user)} alt="avatar" className="w-16 h-16 rounded-full object-cover border border-brand-500/30 bg-brand-500/15 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-white">Signed in</h1>
        <p className="text-sm text-gray-400 mt-2 truncate">{user.email}</p>
        <button onClick={() => navigate('/profile')} className="mt-5 w-full h-12 rounded-full bg-brand-500 text-black font-bold">
          Open Profile
        </button>
      </div>
    );
  }

  if (!firebaseReady) {
    return (
      <div className="w-full max-w-md mx-auto rounded-2xl bg-[#111111] border border-white/10 p-5 sm:p-6">
        <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center mb-5">
          <Database className="w-7 h-7 text-brand-400" />
        </div>
        <h1 className="text-2xl font-black text-white">Firebase setup needed</h1>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          Add your Firebase web app values to `.env`, then enable Email/Password auth and Realtime Database in Firebase.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl bg-[#111111] border border-white/10 p-4 sm:p-6 shadow-2xl shadow-black/60">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
          <User className="w-6 h-6 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
          <p className="text-sm text-gray-500">Sync your watchlist and progress.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-full bg-black/30 border border-white/10 p-1 mb-5">
        <button onClick={() => { setMode('signin'); setError(''); setNotice(''); }} className={`h-10 rounded-full text-sm font-bold transition ${mode === 'signin' ? 'bg-brand-500 text-black' : 'text-gray-400'}`}>
          Sign in
        </button>
        <button onClick={() => { setMode('signup'); setError(''); setNotice(''); }} className={`h-10 rounded-full text-sm font-bold transition ${mode === 'signup' ? 'bg-brand-500 text-black' : 'text-gray-400'}`}>
          Sign up
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && (
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</span>
            <div className="mt-1 flex items-center gap-3 h-12 rounded-xl bg-black/30 border border-white/10 px-3 focus-within:border-brand-500/60">
              <User className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-transparent text-white placeholder-gray-600 focus:outline-none text-base" placeholder="Defaults to your email" />
            </div>
          </label>
        )}

        <label className="block">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</span>
          <div className="mt-1 flex items-center gap-3 h-12 rounded-xl bg-black/30 border border-white/10 px-3 focus-within:border-brand-500/60">
            <Mail className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className="w-full bg-transparent text-white placeholder-gray-600 focus:outline-none text-base" placeholder="you@example.com" />
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</span>
          <div className="mt-1 flex items-center gap-3 h-12 rounded-xl bg-black/30 border border-white/10 px-3 focus-within:border-brand-500/60">
            <Lock className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className="w-full bg-transparent text-white placeholder-gray-600 focus:outline-none text-base" placeholder="Minimum 6 characters" />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="text-gray-500 hover:text-white transition" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </label>

        {error && (
          <div className="flex gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {notice && <div className="rounded-xl bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-300">{notice}</div>}

        <button disabled={busy} className="w-full h-12 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-black transition disabled:opacity-60 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-5 h-5 animate-spin" />}
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px bg-white/10 flex-1" />
        <span className="text-xs text-gray-600">or</span>
        <div className="h-px bg-white/10 flex-1" />
      </div>

      <button onClick={googleSignIn} disabled={busy} className="w-full h-12 rounded-full bg-white/8 hover:bg-white/12 border border-white/10 text-white font-bold transition disabled:opacity-60">
        Continue with Google
      </button>

      {mode === 'signin' && (
        <button onClick={sendReset} disabled={busy} className="mt-4 w-full text-sm text-brand-400 hover:text-brand-300 transition">
          Forgot password?
        </button>
      )}
    </div>
  );
};

const LoginPage = () => (
  <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-10 px-4">
    <AuthPanel />
  </div>
);

type AuthActionStatus = 'checking' | 'ready' | 'done' | 'error';

const getSafeContinueTarget = (continueUrl: string | null) => {
  if (!continueUrl || typeof window === 'undefined') return '/login';
  try {
    const parsed = new URL(continueUrl, window.location.origin);
    if (parsed.origin !== window.location.origin) return '/login';
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/login';
  } catch {
    return '/login';
  }
};

const AuthActionPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');
  const continueUrl = searchParams.get('continueUrl');
  const [status, setStatus] = useState<AuthActionStatus>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const checkActionCode = async () => {
      setMessage('');
      if (mode !== 'resetPassword') {
        setStatus('error');
        setMessage('This account action link is not supported.');
        return;
      }
      if (!auth || !oobCode) {
        setStatus('error');
        setMessage('This reset link is missing required details.');
        return;
      }

      try {
        const resetEmail = await verifyPasswordResetCode(auth, oobCode);
        if (!active) return;
        setEmail(resetEmail);
        setStatus('ready');
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setMessage(getAuthErrorMessage(err));
      }
    };

    void checkActionCode();
    return () => { active = false; };
  }, [mode, oobCode]);

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !oobCode) return;
    if (password.length < 6) {
      setMessage('Use at least 6 characters for your password.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('done');
    } catch (err) {
      setMessage(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const goToSignIn = () => navigate(getSafeContinueTarget(continueUrl), { replace: true });

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-10 px-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-[#111111] border border-white/10 p-5 sm:p-6 shadow-2xl shadow-black/60">
        <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center mb-5">
          {status === 'done' ? <ShieldCheck className="w-7 h-7 text-brand-400" /> : <Lock className="w-7 h-7 text-brand-400" />}
        </div>

        {status === 'checking' && (
          <div className="flex items-center gap-3 text-gray-300">
            <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
            <span>Checking reset link...</span>
          </div>
        )}

        {status === 'ready' && (
          <>
            <h1 className="text-2xl font-black text-white">Reset password</h1>
            <p className="text-sm text-gray-400 mt-2 truncate">{email}</p>

            <form onSubmit={submitReset} className="space-y-3 mt-5">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New password</span>
                <div className="mt-1 flex items-center gap-3 h-12 rounded-xl bg-black/30 border border-white/10 px-3 focus-within:border-brand-500/60">
                  <Lock className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" className="w-full bg-transparent text-white placeholder-gray-600 focus:outline-none text-base" placeholder="Minimum 6 characters" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="text-gray-500 hover:text-white transition" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirm password</span>
                <div className="mt-1 flex items-center gap-3 h-12 rounded-xl bg-black/30 border border-white/10 px-3 focus-within:border-brand-500/60">
                  <ShieldCheck className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" className="w-full bg-transparent text-white placeholder-gray-600 focus:outline-none text-base" placeholder="Repeat password" />
                </div>
              </label>

              {message && (
                <div className="flex gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
              )}

              <button disabled={busy} className="w-full h-12 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-black transition disabled:opacity-60 flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-5 h-5 animate-spin" />}
                Update password
              </button>
            </form>
          </>
        )}

        {status === 'done' && (
          <>
            <h1 className="text-2xl font-black text-white">Password updated</h1>
            <p className="text-sm text-gray-400 mt-2">You can now sign in with your new password.</p>
            <button onClick={goToSignIn} className="mt-5 w-full h-12 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-black transition">
              Sign in
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-2xl font-black text-white">Reset link problem</h1>
            <div className="mt-4 flex gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{message || 'This reset link could not be opened.'}</span>
            </div>
            <button onClick={() => navigate('/login', { replace: true })} className="mt-5 w-full h-12 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-black transition">
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const Navbar = ({ onMenuOpen }: { onMenuOpen: () => void }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
      <div className="flex items-center gap-2 sm:gap-4 px-3 md:px-6 h-16">
        {/* Menu + Logo */}
        <button onClick={onMenuOpen} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition">
          <Menu className="w-5 h-5" />
        </button>

        <Link to="/home" className="flex items-center gap-2 font-bold text-xl text-white flex-shrink-0">
          <Film className="w-6 h-6 text-brand-500" />
          <span className="hidden min-[390px]:inline">MoviWeb</span>
        </Link>

        {/* Quick links */}
        <div className="hidden md:flex items-center gap-1 ml-2">
          <Link to="/home" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5">Home</Link>
          <Link to="/search?type=movie" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5">Movies</Link>
          <Link to="/search?type=tv" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5">TV Shows</Link>
          <Link to="/discover/trending" className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5">Trending</Link>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-sm ml-auto min-w-0">
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
                <img src={getUserAvatar(user)} alt="avatar" className="w-8 h-8 rounded-full object-cover border-2 border-brand-500/50 bg-brand-500/20" />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-white text-sm font-semibold truncate">{getUserDisplayName(user)}</p>
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
              onClick={() => navigate('/login')}
              className="h-10 w-10 sm:w-auto sm:px-4 flex items-center justify-center gap-2 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-semibold text-sm transition"
              aria-label="Sign in"
            >
              <LogIn className="w-4 h-4" /> <span className="hidden sm:inline">Sign In</span>
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
  const navigate = useNavigate();
  const inList = isInWatchlist(id, mediaType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      if (inList) {
        await removeFromWatchlist(id, mediaType);
      } else {
        await addToWatchlist({
          id, mediaType, title, posterPath, rating,
          addedAt: Date.now(), status: 'plan_to_watch',
        });
      }
    } catch (err) {
      console.error('Watchlist update failed:', err);
      setError('Could not save locally. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <button
        onClick={() => navigate('/login')}
        className="flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition border bg-white/8 border-white/10 text-white hover:bg-brand-500/10 hover:border-brand-500/30 hover:text-brand-400"
      >
        <LogIn className="w-4 h-4" />
        Sign in to Save
      </button>
    );
  }

  return (
    <div>
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition border ${
        inList
          ? 'bg-brand-500/20 border-brand-500/50 text-brand-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400'
          : 'bg-white/8 border-white/10 text-white hover:bg-brand-500/10 hover:border-brand-500/30 hover:text-brand-400'
      } disabled:opacity-60`}
    >
      {inList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      {busy ? 'Saving...' : inList ? 'In Watchlist' : 'Add to Watchlist'}
    </button>
    {error && <p className="mt-2 max-w-[220px] text-xs text-red-300">{error}</p>}
    </div>
  );
};

// ─── Native HLS Player ───────────────────────────────────────────────────────

const OfflineDownloadButton = ({
  title,
  sourceUrl,
}: {
  title: string;
  sourceUrl?: string | null;
}) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);

  const saveOffline = async () => {
    setMessage('');
    setSaved(false);
    if (!sourceUrl) {
      setMessage('This source cannot be saved offline yet.');
      return;
    }

    setBusy(true);
    try {
      await saveOfflineVideoFromUrl(sourceUrl, title);
      setSaved(true);
      setMessage('Saved to Downloads.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save this video offline.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => void saveOffline()}
        disabled={busy}
        className="flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition bg-white/8 border border-white/10 text-white hover:bg-white/15 disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {busy ? 'Saving...' : 'Download'}
      </button>
      {message && (
        <p className={`mt-2 max-w-[260px] text-xs leading-relaxed ${saved ? 'text-green-300' : 'text-yellow-300'}`}>
          {message}
          {saved && (
            <button onClick={() => navigate('/profile#downloads')} className="ml-2 text-brand-400 hover:text-brand-300 underline">
              Open
            </button>
          )}
        </p>
      )}
    </div>
  );
};

const NativeVideoPlayer = ({ src, title }: { src: string; title: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let cleanup: (() => void) | undefined;

    import('hls.js').then(({ default: Hls }) => {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: false });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
        cleanup = () => hls.destroy();
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.play().catch(() => {});
      }
    });

    return () => { cleanup?.(); };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 w-full h-full bg-black"
      controls
      playsInline
      title={title}
    />
  );
};

// ─── Page: Movie Detail ───────────────────────────────────────────────────────

const MovieDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToWatchHistory } = useAuth();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [providerIdx, setProviderIdx] = useState(0);
  const [scrapedStream, setScrapedStream] = useState<ScrapedStream | null | 'loading'>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setPlaying(false);
    setTrailerKey(null);
    setScrapedStream(null);
    tmdb.getMovieDetails(Number(id)).then(m => { setMovie(m ?? null); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!playing || !movie || trailerKey) return;
    const t = tmdb.getTitle(movie);
    const y = tmdb.getYear(movie) || '';
    setScrapedStream('loading');
    getMovieStream(t, y).then(s => setScrapedStream(s));
  }, [playing, movie?.id, trailerKey]);

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
  const playMovie = () => {
    setTrailerKey(null);
    setPlaying(true);
    void addToWatchHistory({
      id: movie.id,
      mediaType: 'movie',
      title,
      posterPath: movie.poster_path,
      rating: movie.vote_average,
      watchedAt: Date.now(),
    });
  };

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
                    onClick={() => navigate(`/discover/genre/${g.id}?name=${encodeURIComponent(g.name)}&type=movie`)}>
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
                onClick={playMovie}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-bold text-sm transition btn-shimmer btn-shimmer-brand shadow-lg shadow-brand-500/20"
              >
                <Play className="w-4 h-4 fill-black" /> Play Movie
              </button>
              <WatchlistButton id={movie.id} mediaType="movie" title={title} posterPath={movie.poster_path} rating={movie.vote_average} />
              <OfflineDownloadButton title={title} sourceUrl={null} />
              {trailer && (
                <button
                  onClick={() => { setPlaying(false); setTrailerKey(trailer.key); }}
                  className="flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition bg-white/8 border border-white/10 text-white hover:bg-white/15"
                >
                  Trailer
                </button>
              )}
            </div>

            {/* Provider selector — only when scraper fallback is active */}
            {playing && !trailerKey && scrapedStream === null && (
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
        {(playing || trailerKey) && (
          <div className="mt-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/80 bg-black">
            <div className="flex items-center justify-between px-4 py-2 bg-[#141414] border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-semibold">{trailerKey ? `${title} Trailer` : title}</span>
                {!trailerKey && scrapedStream && scrapedStream !== 'loading' && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">Ad-free</span>
                )}
              </div>
              <button onClick={() => { setPlaying(false); setTrailerKey(null); }} className="text-gray-400 hover:text-white transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              {trailerKey ? (
                <iframe src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&origin=${window.location.origin}`} className="absolute inset-0 w-full h-full" allowFullScreen allow="fullscreen; autoplay; encrypted-media; picture-in-picture" title={`${title} trailer`} />
              ) : (
                <>
                  {scrapedStream === 'loading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
                      <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                      <span className="text-gray-400 text-sm">Finding ad-free stream...</span>
                    </div>
                  )}
                  {scrapedStream && scrapedStream !== 'loading' && (
                    <NativeVideoPlayer src={scrapedStream.url} title={title} />
                  )}
                  {scrapedStream === null && (
                    <iframe src={streamUrl} className="absolute inset-0 w-full h-full" allowFullScreen allow="fullscreen; autoplay" title={title} />
                  )}
                </>
              )}
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
  const { addToWatchHistory } = useAuth();
  const [show, setShow] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonData, setSeasonData] = useState<SeasonDetail | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [providerIdx, setProviderIdx] = useState(0);
  const [scrapedStream, setScrapedStream] = useState<ScrapedStream | null | 'loading'>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setPlaying(false);
    setTrailerKey(null);
    setSelectedEp(null);
    setScrapedStream(null);
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

  useEffect(() => {
    if (!playing || !show || trailerKey) return;
    const t = tmdb.getTitle(show);
    const y = tmdb.getYear(show) || '';
    const s = selectedEp?.season_number ?? selectedSeason;
    const e = selectedEp?.episode_number ?? 1;
    setScrapedStream('loading');
    getTVStream(t, y, s, e).then(stream => setScrapedStream(stream));
  }, [playing, show?.id, selectedEp?.season_number, selectedEp?.episode_number, trailerKey]);

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
  const recordTVPlay = (episode?: Episode | null) => {
    void addToWatchHistory({
      id: show.id,
      mediaType: 'tv',
      title,
      posterPath: show.poster_path,
      rating: show.vote_average,
      watchedAt: Date.now(),
      seasonNumber: episode?.season_number ?? selectedSeason,
      episodeNumber: episode?.episode_number ?? 1,
      episodeTitle: episode?.name,
    });
  };
  const playTV = () => {
    const firstEpisode = selectedEp ?? seasonData?.episodes?.[0] ?? null;
    setTrailerKey(null);
    if (firstEpisode) setSelectedEp(firstEpisode);
    setPlaying(true);
    recordTVPlay(firstEpisode);
  };
  const playEpisode = (episode: Episode) => {
    setTrailerKey(null);
    setSelectedEp(episode);
    setPlaying(true);
    recordTVPlay(episode);
  };

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
                  <span key={g.id} className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-300 hover:border-brand-500/30 hover:text-brand-400 transition cursor-pointer"
                    onClick={() => navigate(`/discover/genre/${g.id}?name=${encodeURIComponent(g.name)}&type=tv`)}>
                    {g.name}
                  </span>
                ))}
              </div>
            )}
            <p className="text-gray-300 text-sm leading-relaxed mb-6 max-w-2xl">{show.overview}</p>
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={playTV}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-400 text-black font-bold text-sm transition btn-shimmer btn-shimmer-brand shadow-lg shadow-brand-500/20"
              >
                <Play className="w-4 h-4 fill-black" /> Play
              </button>
              <WatchlistButton id={show.id} mediaType="tv" title={title} posterPath={show.poster_path} rating={show.vote_average} />
              <OfflineDownloadButton title={title} sourceUrl={null} />
              {trailer && (
                <button onClick={() => { setPlaying(false); setTrailerKey(trailer.key); }}
                  className="flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition bg-white/8 border border-white/10 text-white hover:bg-white/15">
                  Trailer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Player */}
        {(playing || trailerKey) && (
          <div className="mt-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/80 bg-black">
            <div className="flex items-center justify-between px-4 py-2 bg-[#141414] border-b border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-white text-sm font-semibold truncate">
                  {title} {selectedEp ? `— S${selectedEp.season_number}E${selectedEp.episode_number}: ${selectedEp.name}` : ''}
                </span>
                {!trailerKey && scrapedStream && scrapedStream !== 'loading' && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">Ad-free</span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {!trailerKey && scrapedStream === null && STREAM_PROVIDERS.map((p, i) => (
                  <button key={p.key} onClick={() => setProviderIdx(i)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition ${i === providerIdx ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-white'}`}>
                    {p.label}
                  </button>
                ))}
                <button onClick={() => { setPlaying(false); setTrailerKey(null); }} className="text-gray-400 hover:text-white transition ml-2"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              {trailerKey && (
                <iframe src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&origin=${window.location.origin}`} className="absolute inset-0 w-full h-full" allowFullScreen allow="fullscreen; autoplay; encrypted-media; picture-in-picture" title={`${title} trailer`} />
              )}
              {!trailerKey && scrapedStream === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
                  <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                  <span className="text-gray-400 text-sm">Finding ad-free stream...</span>
                </div>
              )}
              {!trailerKey && scrapedStream && scrapedStream !== 'loading' && (
                <NativeVideoPlayer src={scrapedStream.url} title={title} />
              )}
              {!trailerKey && scrapedStream === null && (
                <iframe src={streamUrl} className="absolute inset-0 w-full h-full" allowFullScreen allow="fullscreen; autoplay" title={title} />
              )}
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
                    onClick={() => playEpisode(ep)}
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
  const { category, sub } = useParams<{ category: string; sub?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const genreName = searchParams.get('name') ?? '';
  const typeParam = searchParams.get('type');
  const genreType: 'movie' | 'tv' = typeParam === 'tv' ? 'tv' : 'movie';
  const isGenrePage = category === 'genre' && !!sub;
  const navigate = useNavigate();
  const [items, setItems] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const title = useMemo(() => {
    if (category === 'trending') return 'Trending Now';
    if (category === 'top-rated') return 'Top Rated';
    if (category === 'new') return 'New Releases';
    if (isGenrePage) return genreName || 'Genre';
    return category ?? 'Discover';
  }, [category, genreName, isGenrePage]);

  useEffect(() => {
    setPage(1);
  }, [category, sub, genreType]);

  useEffect(() => {
    setLoading(true);
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
      } else if (isGenrePage && sub) {
        const discover = genreType === 'tv' ? tmdb.discoverTV : tmdb.discoverMovies;
        const d = await discover({ with_genres: sub, sort_by: 'popularity.desc' }, page);
        results = d.results; tp = d.total_pages;
      }
      setItems(results);
      setTotalPages(tp);
      setLoading(false);
    };
    load();
  }, [category, sub, genreType, isGenrePage, page]);

  const goCard = (item: Movie) => { const type = tmdb.getMediaType(item); navigate(`/${type}/${item.id}`); };

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

  const setGenreType = (type: 'movie' | 'tv') => {
    if (!sub) return;
    setSearchParams({ name: genreName, type });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-16 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
        {isGenrePage && (
          <div className="flex gap-2 mb-5">
            {(['movie', 'tv'] as const).map(type => (
              <button key={type} onClick={() => setGenreType(type)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${genreType === type ? 'bg-brand-500 text-black' : 'bg-white/8 text-gray-400 hover:text-white border border-white/10'}`}>
                {type === 'movie' ? 'Movies' : 'TV Shows'}
              </button>
            ))}
          </div>
        )}
        <p className="text-gray-500 text-sm mb-8">{items.length} titles</p>
        {loading ? <GridSkeleton count={20} /> : items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {items.map(item => <MovieCard key={`${item.id}-${item.media_type ?? tmdb.getMediaType(item)}`} item={item} onClick={goCard} />)}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-10">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {pageNums.map((p, i) => (
                  <button key={i} onClick={() => typeof p === 'number' && setPage(p)}
                    disabled={p === '...'}
                    className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-bold transition ${
                      p === page ? 'bg-brand-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                      : typeof p === 'number' ? 'bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-white/10'
                      : 'text-gray-600 cursor-default'
                    }`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-gray-400">
            No titles found for this genre.
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Page: Profile ────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const {
    user, logout, watchlist, watchHistory, removeFromWatchlist, updateWatchlistItem,
    removeFromWatchHistory, clearWatchHistory,
  } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [offlineItems, setOfflineItems] = useState<OfflineVideoItem[]>([]);
  const [offlineLoading, setOfflineLoading] = useState(true);
  const [offlineSaving, setOfflineSaving] = useState(false);
  const [offlineError, setOfflineError] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [directTitle, setDirectTitle] = useState('');
  const [offlinePlayer, setOfflinePlayer] = useState<{ item: OfflineVideoItem; url: string } | null>(null);

  const refreshOfflineItems = useCallback(async () => {
    setOfflineLoading(true);
    try {
      setOfflineItems(await listOfflineVideos());
      setOfflineError('');
    } catch (err) {
      setOfflineError(err instanceof Error ? err.message : 'Could not load offline videos.');
    } finally {
      setOfflineLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshOfflineItems();
  }, [refreshOfflineItems]);

  useEffect(() => () => {
    if (offlinePlayer?.url) URL.revokeObjectURL(offlinePlayer.url);
  }, [offlinePlayer?.url]);

  const importOfflineFiles = async (files: FileList | null) => {
    const videos = Array.from(files ?? []);
    if (videos.length === 0) return;
    setOfflineSaving(true);
    setOfflineError('');
    try {
      for (const file of videos) await saveOfflineVideoFromFile(file);
      await refreshOfflineItems();
    } catch (err) {
      setOfflineError(err instanceof Error ? err.message : 'Could not import that video.');
    } finally {
      setOfflineSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveDirectOfflineUrl = async () => {
    if (!directUrl.trim()) return;
    setOfflineSaving(true);
    setOfflineError('');
    try {
      await saveOfflineVideoFromUrl(directUrl, directTitle);
      setDirectUrl('');
      setDirectTitle('');
      await refreshOfflineItems();
    } catch (err) {
      setOfflineError(err instanceof Error ? err.message : 'Could not save that video.');
    } finally {
      setOfflineSaving(false);
    }
  };

  const playOfflineItem = async (item: OfflineVideoItem) => {
    setOfflineError('');
    try {
      const record = await getOfflineVideo(item.id);
      const url = URL.createObjectURL(record.blob);
      setOfflinePlayer({ item, url });
    } catch (err) {
      setOfflineError(err instanceof Error ? err.message : 'Could not open that offline video.');
    }
  };

  const removeOfflineItem = async (item: OfflineVideoItem) => {
    try {
      await deleteOfflineVideo(item.id);
      if (offlinePlayer?.item.id === item.id) setOfflinePlayer(null);
      await refreshOfflineItems();
    } catch (err) {
      setOfflineError(err instanceof Error ? err.message : 'Could not delete that video.');
    }
  };

  if (!user) return (
    <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-10 px-4">
      <AuthPanel />
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
  const formatHistoryDate = (value: number) => new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
  const historyLabel = (item: WatchHistoryItem) =>
    item.mediaType === 'tv' && item.seasonNumber && item.episodeNumber
      ? `S${item.seasonNumber}E${item.episodeNumber}${item.episodeTitle ? `: ${item.episodeTitle}` : ''}`
      : 'Movie';

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-16 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-10 p-5 sm:p-6 rounded-2xl bg-[#111111] border border-white/5">
          <img src={getUserAvatar(user)} alt="avatar" className="w-20 h-20 rounded-full border-2 border-brand-500/50 object-cover bg-brand-500/20" />
          <div className="min-w-0 text-center sm:text-left">
            <h1 className="text-white font-bold text-2xl truncate">{getUserDisplayName(user)}</h1>
            <p className="text-gray-500 text-sm truncate">{user.email}</p>
            <div className="flex justify-center sm:justify-start gap-4 mt-2">
              <span className="text-gray-400 text-sm"><span className="text-white font-bold">{watchlist.length}</span> in watchlist</span>
              <span className="text-gray-400 text-sm"><span className="text-white font-bold">{watchHistory.length}</span> watched</span>
              <span className="text-gray-400 text-sm"><span className="text-white font-bold">{offlineItems.length}</span> offline</span>
              <span className="text-gray-400 text-sm"><span className="text-white font-bold">{watchlist.filter(w => w.status === 'completed').length}</span> completed</span>
            </div>
          </div>
          <button onClick={logout} className="sm:ml-auto w-full sm:w-auto h-11 flex items-center justify-center gap-2 px-4 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/5 text-sm transition border border-white/5">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* Watchlist */}
        <div id="watchlist" className="mb-10">
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

        {/* Watch history */}
        <div id="history" className="mb-10">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-white font-bold text-xl">Watch History</h2>
            {watchHistory.length > 0 && (
              <button onClick={clearWatchHistory} className="text-xs text-gray-500 hover:text-red-400 transition">
                Clear
              </button>
            )}
          </div>
          {watchHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border border-white/5 rounded-2xl bg-[#111111]">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No watch history yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {watchHistory.map(item => (
                <div key={`${item.mediaType}-${item.id}-${item.seasonNumber ?? 0}-${item.episodeNumber ?? 0}`} className="flex gap-4 p-3 rounded-xl bg-[#111111] border border-white/5 hover:border-white/10 transition">
                  <button onClick={() => navigate(`/${item.mediaType}/${item.id}`)} className="flex-shrink-0 w-16 aspect-[2/3] rounded-lg overflow-hidden bg-[#1e1e1e]">
                    <LazyImage src={posterUrl(item.posterPath)} alt={item.title} className="w-full h-full" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate(`/${item.mediaType}/${item.id}`)} className="text-white font-semibold text-sm hover:text-brand-400 transition truncate block text-left">
                      {item.title}
                    </button>
                    <p className="text-gray-500 text-xs mt-1 truncate">{historyLabel(item)}</p>
                    <p className="text-gray-600 text-xs mt-1">{formatHistoryDate(item.watchedAt)}</p>
                  </div>
                  <button onClick={() => removeFromWatchHistory(item)} className="self-start p-1.5 text-gray-600 hover:text-red-400 transition rounded-lg hover:bg-red-500/5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Downloads */}
        <div id="downloads">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-white font-bold text-xl">Downloads</h2>
              <p className="text-gray-500 text-sm mt-1">{offlineItems.length} saved offline</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.webm,.m4v,.mov,.mkv"
                multiple
                className="hidden"
                onChange={e => void importOfflineFiles(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={offlineSaving}
                className="h-11 px-4 rounded-lg bg-brand-500 text-black font-bold text-sm hover:bg-brand-400 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {offlineSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Import Video
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_auto] gap-2 mb-4">
            <input
              value={directTitle}
              onChange={e => setDirectTitle(e.target.value)}
              placeholder="Title"
              className="h-11 rounded-lg bg-[#111111] border border-white/10 px-3 text-white text-sm outline-none focus:border-brand-500/50"
            />
            <div className="grid sm:grid-cols-[1fr_auto] gap-2">
              <input
                value={directUrl}
                onChange={e => setDirectUrl(e.target.value)}
                placeholder="Direct video URL"
                className="h-11 rounded-lg bg-[#111111] border border-white/10 px-3 text-white text-sm outline-none focus:border-brand-500/50"
              />
              <button
                onClick={() => void saveDirectOfflineUrl()}
                disabled={offlineSaving || !directUrl.trim()}
                className="h-11 px-4 rounded-lg bg-white/8 border border-white/10 text-white font-semibold text-sm hover:bg-white/15 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>

          {offlineError && (
            <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {offlineError}
            </div>
          )}

          {offlinePlayer && (
            <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 bg-black">
              <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#141414] border-b border-white/5">
                <span className="text-white text-sm font-semibold truncate">{offlinePlayer.item.title}</span>
                <button onClick={() => setOfflinePlayer(null)} className="text-gray-400 hover:text-white transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                <video src={offlinePlayer.url} className="absolute inset-0 w-full h-full bg-black" controls playsInline autoPlay />
              </div>
            </div>
          )}

          {offlineLoading ? (
            <div className="text-center py-12 text-gray-500 border border-white/5 rounded-2xl bg-[#111111]">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-brand-400" />
              <p>Loading offline videos...</p>
            </div>
          ) : offlineItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border border-white/5 rounded-2xl bg-[#111111]">
              <Download className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No downloaded titles.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {offlineItems.map(item => (
                <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-[#111111] border border-white/5 hover:border-white/10 transition">
                  <button
                    onClick={() => void playOfflineItem(item)}
                    className="flex-shrink-0 w-16 aspect-video rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400"
                  >
                    <Play className="w-5 h-5 fill-current" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => void playOfflineItem(item)} className="text-white font-semibold text-sm hover:text-brand-400 transition truncate block text-left">
                      {item.title}
                    </button>
                    <p className="text-gray-500 text-xs mt-1 truncate">{item.fileName}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-gray-600 text-xs">{formatBytes(item.size)}</span>
                      <span className="text-gray-700 text-xs">|</span>
                      <span className="text-gray-600 text-xs">{new Date(item.createdAt).toLocaleDateString()}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-500 text-[11px]">
                        {item.source === 'local_file' ? 'File' : 'URL'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => void removeOfflineItem(item)} className="self-start p-1.5 text-gray-600 hover:text-red-400 transition rounded-lg hover:bg-red-500/5">
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/action" element={<AuthActionPage />} />
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
