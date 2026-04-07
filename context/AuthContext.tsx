import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { ref, set, get, remove, onValue } from 'firebase/database';
import { auth, googleProvider, db, firebaseEnabled } from '../services/firebase';
import type { WatchlistItem } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  watchlist: WatchlistItem[];
  addToWatchlist: (item: WatchlistItem) => Promise<void>;
  removeFromWatchlist: (id: number, mediaType: 'movie' | 'tv') => Promise<void>;
  updateWatchlistItem: (id: number, mediaType: 'movie' | 'tv', updates: Partial<WatchlistItem>) => Promise<void>;
  isInWatchlist: (id: number, mediaType: 'movie' | 'tv') => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  // Auth state listener
  useEffect(() => {
    if (!firebaseEnabled || !auth) { setLoading(false); return; }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Watchlist listener when user changes
  useEffect(() => {
    if (!user || !db) { setWatchlist([]); return; }
    const watchlistRef = ref(db, `users/${user.uid}/watchlist`);
    const unsub = onValue(watchlistRef, (snap) => {
      if (!snap.exists()) { setWatchlist([]); return; }
      const data = snap.val() as Record<string, WatchlistItem>;
      setWatchlist(Object.values(data).sort((a, b) => b.addedAt - a.addedAt));
    });
    return () => unsub();
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) return;
    try { await signInWithPopup(auth, googleProvider); } catch (err) { console.error('Sign in error:', err); }
  }, []);

  const logout = useCallback(async () => {
    if (!auth) return;
    try { await signOut(auth); } catch (err) { console.error('Logout error:', err); }
  }, []);

  const watchlistKey = (id: number, mediaType: 'movie' | 'tv') => `${mediaType}_${id}`;

  const addToWatchlist = useCallback(async (item: WatchlistItem) => {
    if (!user || !db) return;
    const itemRef = ref(db, `users/${user.uid}/watchlist/${watchlistKey(item.id, item.mediaType)}`);
    await set(itemRef, item);
  }, [user]);

  const removeFromWatchlist = useCallback(async (id: number, mediaType: 'movie' | 'tv') => {
    if (!user || !db) return;
    const itemRef = ref(db, `users/${user.uid}/watchlist/${watchlistKey(id, mediaType)}`);
    await remove(itemRef);
  }, [user]);

  const updateWatchlistItem = useCallback(async (id: number, mediaType: 'movie' | 'tv', updates: Partial<WatchlistItem>) => {
    if (!user || !db) return;
    const key = watchlistKey(id, mediaType);
    const itemRef = ref(db, `users/${user.uid}/watchlist/${key}`);
    const snap = await get(itemRef);
    if (!snap.exists()) return;
    await set(itemRef, { ...snap.val(), ...updates });
  }, [user]);

  const isInWatchlist = useCallback((id: number, mediaType: 'movie' | 'tv') =>
    watchlist.some(w => w.id === id && w.mediaType === mediaType), [watchlist]);

  return (
    <AuthContext.Provider value={{
      user, loading, signInWithGoogle, logout,
      watchlist, addToWatchlist, removeFromWatchlist, updateWatchlistItem, isInWatchlist,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
