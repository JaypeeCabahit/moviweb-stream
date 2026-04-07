interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

class CacheService {
  private prefix = 'moviweb_cache_v1_';
  private durations = {
    movie: 30 * 60 * 1000,    // 30 min for movie/TV data
    search: 10 * 60 * 1000,   // 10 min for search results
    home: 5 * 60 * 1000,      // 5 min for home/trending lists
    stream: 2 * 60 * 1000,    // 2 min for streaming sources
  };

  set<T>(key: string, data: T, type: keyof typeof this.durations = 'movie'): void {
    const item: CacheItem<T> = { data, timestamp: Date.now(), expiresIn: this.durations[type] };
    const serialized = JSON.stringify(item);
    try {
      localStorage.setItem(this.prefix + key, serialized);
    } catch {
      this.clearExpired();
      try { localStorage.setItem(this.prefix + key, serialized); } catch { this.evictOldest(serialized.length); try { localStorage.setItem(this.prefix + key, serialized); } catch { /* give up */ } }
    }
  }

  private evictOldest(neededBytes: number): void {
    const entries: { key: string; timestamp: number }[] = [];
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(this.prefix)) continue;
      try { const raw = localStorage.getItem(key); if (!raw) continue; const p: CacheItem<any> = JSON.parse(raw); entries.push({ key, timestamp: p.timestamp }); } catch { localStorage.removeItem(key); }
    }
    entries.sort((a, b) => a.timestamp - b.timestamp);
    let freed = 0;
    for (const e of entries) { const item = localStorage.getItem(e.key); freed += item ? item.length : 0; localStorage.removeItem(e.key); if (freed >= neededBytes) break; }
  }

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;
      const cached: CacheItem<T> = JSON.parse(item);
      if (Date.now() - cached.timestamp > cached.expiresIn) { this.remove(key); return null; }
      return cached.data;
    } catch { return null; }
  }

  remove(key: string): void { try { localStorage.removeItem(this.prefix + key); } catch { /* ignore */ } }

  clearExpired(): void {
    const now = Date.now();
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(this.prefix)) continue;
      try { const item = localStorage.getItem(key); if (!item) continue; const c: CacheItem<any> = JSON.parse(item); if (now - c.timestamp > c.expiresIn) localStorage.removeItem(key); } catch { localStorage.removeItem(key); }
    }
  }

  clearAll(): void { for (const key of Object.keys(localStorage)) { if (key.startsWith(this.prefix)) localStorage.removeItem(key); } }
}

export const cacheService = new CacheService();

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  cacheType: 'movie' | 'search' | 'home' | 'stream' = 'movie'
): Promise<T> {
  const cached = cacheService.get<T>(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  const isEmpty = data === null || data === undefined || (Array.isArray(data) && data.length === 0);
  if (!isEmpty) cacheService.set(key, data, cacheType);
  return data;
}
