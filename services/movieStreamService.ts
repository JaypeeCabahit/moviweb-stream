const YORUMI_BASE = (import.meta.env.VITE_YORUMI_API_BASE as string) || '';

export interface ScrapedStream {
    url: string;
    quality: string;
    isM3U8: boolean;
}

export async function getMovieStream(title: string, year: string): Promise<ScrapedStream | null> {
    if (!YORUMI_BASE) return null;
    try {
        const params = new URLSearchParams({ title, year, type: 'movie' });
        const res = await fetch(`${YORUMI_BASE}/api/movies/stream?${params}`, {
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function getTVStream(
    title: string,
    year: string,
    season: number,
    episode: number,
): Promise<ScrapedStream | null> {
    if (!YORUMI_BASE) return null;
    try {
        const params = new URLSearchParams({
            title,
            year,
            type: 'tv',
            season: String(season),
            episode: String(episode),
        });
        const res = await fetch(`${YORUMI_BASE}/api/movies/stream?${params}`, {
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
