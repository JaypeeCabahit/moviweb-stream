import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  type ActionCodeSettings,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import { ref, set, get, remove, onValue } from 'firebase/database';
import { auth, googleProvider, db, firebaseEnabled } from '../services/firebase';
import type { WatchHistoryItem, WatchlistItem } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  firebaseReady: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (displayName: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  watchlist: WatchlistItem[];
  watchHistory: WatchHistoryItem[];
  addToWatchlist: (item: WatchlistItem) => Promise<void>;
  removeFromWatchlist: (id: number, mediaType: 'movie' | 'tv') => Promise<void>;
  updateWatchlistItem: (id: number, mediaType: 'movie' | 'tv', updates: Partial<WatchlistItem>) => Promise<void>;
  isInWatchlist: (id: number, mediaType: 'movie' | 'tv') => boolean;
  addToWatchHistory: (item: WatchHistoryItem) => Promise<void>;
  removeFromWatchHistory: (item: WatchHistoryItem) => Promise<void>;
  clearWatchHistory: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

const watchlistKey = (id: number, mediaType: 'movie' | 'tv') => `${mediaType}_${id}`;
const historyKey = (item: Pick<WatchHistoryItem, 'id' | 'mediaType' | 'seasonNumber' | 'episodeNumber'>) =>
  `${item.mediaType}_${item.id}_${item.seasonNumber ?? 0}_${item.episodeNumber ?? 0}`;

const localKey = (uid: string, collection: 'watchlist' | 'history') => `moviweb_${collection}_${uid}`;

const getPasswordResetActionSettings = (): ActionCodeSettings | undefined => {
  const configuredSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim();
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const baseUrl = configuredSiteUrl || currentOrigin;
  if (!baseUrl) return undefined;

  try {
    const url = new URL('/login', baseUrl);
    const isLocalUrl = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (!configuredSiteUrl && isLocalUrl) return undefined;

    const settings: ActionCodeSettings = {
      url: url.toString(),
      handleCodeInApp: false,
    };
    const linkDomain = (import.meta.env.VITE_FIREBASE_AUTH_LINK_DOMAIN as string | undefined)?.trim();
    if (linkDomain) settings.linkDomain = linkDomain;
    return settings;
  } catch {
    return undefined;
  }
};

const readLocalItems = <T,>(uid: string, collection: 'watchlist' | 'history'): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(localKey(uid, collection));
    return raw ? JSON.parse(raw) as T[] : [];
  } catch {
    return [];
  }
};

const writeLocalItems = <T,>(uid: string, collection: 'watchlist' | 'history', items: T[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(localKey(uid, collection), JSON.stringify(items));
  } catch (err) {
    console.warn(`Local ${collection} save failed:`, err);
  }
};

const sortWatchlist = (items: WatchlistItem[]) => [...items].sort((a, b) => b.addedAt - a.addedAt);
const sortHistory = (items: WatchHistoryItem[]) => [...items].sort((a, b) => b.watchedAt - a.watchedAt).slice(0, 50);

const mergeByKey = <T,>(remote: T[], local: T[], getKey: (item: T) => string) => {
  const merged = new Map<string, T>();
  [...remote, ...local].forEach(item => merged.set(getKey(item), item));
  return Array.from(merged.values());
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);

  const ensureAuth = () => {
    if (!auth) throw new Error('Firebase is not configured yet.');
    return auth;
  };

  const upsertUserProfile = useCallback(async (u: User) => {
    if (!db) return;
    try {
      const profileRef = ref(db, `users/${u.uid}/profile`);
      const snap = await get(profileRef);
      const existing = snap.exists() ? snap.val() : {};
      const now = Date.now();
      await set(profileRef, {
        ...existing,
        uid: u.uid,
        displayName: u.displayName || u.email || '',
        email: u.email ?? '',
        photoURL: u.photoURL ?? '',
        createdAt: existing.createdAt ?? now,
        updatedAt: now,
      });
    } catch (err) {
      console.warn('Profile sync failed:', err);
    }
  }, []);

  useEffect(() => {
    if (!firebaseEnabled || !auth) { setLoading(false); return; }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) void upsertUserProfile(u);
      setLoading(false);
    });
    return unsub;
  }, [upsertUserProfile]);

  useEffect(() => {
    if (!user) { setWatchlist([]); return; }
    const local = sortWatchlist(readLocalItems<WatchlistItem>(user.uid, 'watchlist'));
    setWatchlist(local);
    if (!db) return;
    const watchlistRef = ref(db, `users/${user.uid}/watchlist`);
    const unsub = onValue(watchlistRef, (snap) => {
      const remote = snap.exists() ? Object.values(snap.val() as Record<string, WatchlistItem>) : [];
      const latestLocal = readLocalItems<WatchlistItem>(user.uid, 'watchlist');
      const merged = sortWatchlist(mergeByKey(remote, latestLocal, item => watchlistKey(item.id, item.mediaType)));
      writeLocalItems(user.uid, 'watchlist', merged);
      setWatchlist(merged);
    }, (err) => {
      console.error('Watchlist sync failed:', err);
      setWatchlist(sortWatchlist(readLocalItems<WatchlistItem>(user.uid, 'watchlist')));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) { setWatchHistory([]); return; }
    const local = sortHistory(readLocalItems<WatchHistoryItem>(user.uid, 'history'));
    setWatchHistory(local);
    if (!db) return;
    const historyRef = ref(db, `users/${user.uid}/history`);
    const unsub = onValue(historyRef, (snap) => {
      const remote = snap.exists() ? Object.values(snap.val() as Record<string, WatchHistoryItem>) : [];
      const latestLocal = readLocalItems<WatchHistoryItem>(user.uid, 'history');
      const merged = sortHistory(mergeByKey(remote, latestLocal, historyKey));
      writeLocalItems(user.uid, 'history', merged);
      setWatchHistory(merged);
    }, (err) => {
      console.error('Watch history sync failed:', err);
      setWatchHistory(sortHistory(readLocalItems<WatchHistoryItem>(user.uid, 'history')));
    });
    return () => unsub();
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    const currentAuth = ensureAuth();
    const result = await signInWithPopup(currentAuth, googleProvider);
    await upsertUserProfile(result.user);
  }, [upsertUserProfile]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const currentAuth = ensureAuth();
    const result = await signInWithEmailAndPassword(currentAuth, email.trim(), password);
    await upsertUserProfile(result.user);
  }, [upsertUserProfile]);

  const signUpWithEmail = useCallback(async (displayName: string, email: string, password: string) => {
    const currentAuth = ensureAuth();
    const cleanEmail = email.trim();
    const result = await createUserWithEmailAndPassword(currentAuth, cleanEmail, password);
    const cleanName = displayName.trim() || cleanEmail;
    await updateProfile(result.user, { displayName: cleanName });
    await upsertUserProfile(result.user);
  }, [upsertUserProfile]);

  const resetPassword = useCallback(async (email: string) => {
    const currentAuth = ensureAuth();
    await sendPasswordResetEmail(currentAuth, email.trim(), getPasswordResetActionSettings());
  }, []);

  const logout = useCallback(async () => {
    if (!auth) return;
    try { await signOut(auth); } catch (err) { console.error('Logout error:', err); }
  }, []);

  const addToWatchlist = useCallback(async (item: WatchlistItem) => {
    if (!user) return;
    const next = sortWatchlist([item, ...watchlist.filter(w => !(w.id === item.id && w.mediaType === item.mediaType))]);
    setWatchlist(next);
    writeLocalItems(user.uid, 'watchlist', next);
    if (!db) return;
    try {
      const itemRef = ref(db, `users/${user.uid}/watchlist/${watchlistKey(item.id, item.mediaType)}`);
      await set(itemRef, item);
    } catch (err) {
      console.warn('Cloud watchlist save failed; kept local copy:', err);
    }
  }, [user, watchlist]);

  const removeFromWatchlist = useCallback(async (id: number, mediaType: 'movie' | 'tv') => {
    if (!user) return;
    const next = sortWatchlist(watchlist.filter(w => !(w.id === id && w.mediaType === mediaType)));
    setWatchlist(next);
    writeLocalItems(user.uid, 'watchlist', next);
    if (!db) return;
    try {
      const itemRef = ref(db, `users/${user.uid}/watchlist/${watchlistKey(id, mediaType)}`);
      await remove(itemRef);
    } catch (err) {
      console.warn('Cloud watchlist remove failed; kept local change:', err);
    }
  }, [user, watchlist]);

  const updateWatchlistItem = useCallback(async (id: number, mediaType: 'movie' | 'tv', updates: Partial<WatchlistItem>) => {
    if (!user) return;
    const key = watchlistKey(id, mediaType);
    const current = watchlist.find(w => w.id === id && w.mediaType === mediaType);
    if (!current) return;
    const updated = { ...current, ...updates };
    const next = sortWatchlist(watchlist.map(w => (w.id === id && w.mediaType === mediaType ? updated : w)));
    setWatchlist(next);
    writeLocalItems(user.uid, 'watchlist', next);
    if (!db) return;
    try {
      const itemRef = ref(db, `users/${user.uid}/watchlist/${key}`);
      const snap = await get(itemRef);
      await set(itemRef, { ...(snap.exists() ? snap.val() : current), ...updates });
    } catch (err) {
      console.warn('Cloud watchlist update failed; kept local change:', err);
    }
  }, [user, watchlist]);

  const isInWatchlist = useCallback((id: number, mediaType: 'movie' | 'tv') =>
    watchlist.some(w => w.id === id && w.mediaType === mediaType), [watchlist]);

  const addToWatchHistory = useCallback(async (item: WatchHistoryItem) => {
    if (!user) return;
    const next = sortHistory([item, ...watchHistory.filter(h => historyKey(h) !== historyKey(item))]);
    setWatchHistory(next);
    writeLocalItems(user.uid, 'history', next);
    if (!db) return;
    try {
      const itemRef = ref(db, `users/${user.uid}/history/${historyKey(item)}`);
      await set(itemRef, item);
    } catch (err) {
      console.warn('Cloud watch history save failed; kept local copy:', err);
    }
  }, [user, watchHistory]);

  const removeFromWatchHistory = useCallback(async (item: WatchHistoryItem) => {
    if (!user) return;
    const next = sortHistory(watchHistory.filter(h => historyKey(h) !== historyKey(item)));
    setWatchHistory(next);
    writeLocalItems(user.uid, 'history', next);
    if (!db) return;
    try {
      await remove(ref(db, `users/${user.uid}/history/${historyKey(item)}`));
    } catch (err) {
      console.warn('Cloud watch history remove failed; kept local change:', err);
    }
  }, [user, watchHistory]);

  const clearWatchHistory = useCallback(async () => {
    if (!user) return;
    setWatchHistory([]);
    writeLocalItems(user.uid, 'history', []);
    if (!db) return;
    try {
      await remove(ref(db, `users/${user.uid}/history`));
    } catch (err) {
      console.warn('Cloud watch history clear failed; kept local change:', err);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, loading, firebaseReady: firebaseEnabled, signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, logout,
      watchlist, watchHistory, addToWatchlist, removeFromWatchlist, updateWatchlistItem, isInWatchlist,
      addToWatchHistory, removeFromWatchHistory, clearWatchHistory,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
