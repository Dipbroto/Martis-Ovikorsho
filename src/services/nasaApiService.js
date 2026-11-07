
const NASA_IMAGE_API = 'https://images-api.nasa.gov';

// Results are kept for a day (in memory and in localStorage), so opening the gallery or going back to a
// category is instant, and a search that was already made never waits on NASA again.
const CACHE_PREFIX = 'marswalk-nasa-v3:';
const CACHE_TTL_MS = 24 * 3600e3;
const PAGE_SIZE = 40;
const memory = new Map();

const cacheKey = (query, page) => `${CACHE_PREFIX}${page}:${query.trim().toLowerCase()}`;

function readCache(key) {
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key, items) {
  const entry = { at: Date.now(), items };
  memory.set(key, entry);
  try {
    localStorage.setItem(key, JSON.stringify({ at: entry.at, items: items.map((i) => ({ ...i, description: i.description?.slice(0, 700) })) }));
  } catch {
    // storage full or blocked: the memory copy still works
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).slice(0, 6).forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }
}

/** Results already fetched for a search, or null. `fresh` says whether they are recent enough to skip the network. */
export function getCachedImagery(query = 'Mars Perseverance', page = 1) {
  const hit = readCache(cacheKey(query, page));
  return hit ? { items: hit.items, fresh: Date.now() - hit.at < CACHE_TTL_MS } : null;
}

/**
 * Fetches imagery from the NASA Image and Video Library API. Recent results come straight from the cache;
 * otherwise 40 results are fetched (a smaller answer than the library's default 100), and an older cached
 * answer is used if the network fails.
 */
export const fetchMarsImagery = async (query = 'Mars Perseverance', page = 1, { signal } = {}) => {
  const key = cacheKey(query, page);
  const cached = getCachedImagery(query, page);
  if (cached?.fresh) return cached.items;
  try {
    const response = await fetch(`${NASA_IMAGE_API}/search?q=${encodeURIComponent(query)}&media_type=image&page=${page}&page_size=${PAGE_SIZE}`, { signal });
    if (!response.ok) throw new Error('NASA API request failed');

    const data = await response.json();

    // Map NASA API items to our app's imagery format
    const items = (data.collection.items || []).map((item, index) => {
      const itemData = item.data[0];
      const links = item.links || [];

      // Strictly filter for browser-friendly lightweight formats
      const safeLinks = links.filter((l) => l.href.match(/\.(jpg|jpeg|png)$/i));

      const thumb = safeLinks.find((l) => l.href.includes('~thumb'))?.href;
      const small = safeLinks.find((l) => l.href.includes('~small'))?.href;
      const medium = safeLinks.find((l) => l.href.includes('~medium'))?.href;
      const large = safeLinks.find((l) => l.href.includes('~large'))?.href;
      const fallback = safeLinks.find((l) => l.render === 'image')?.href || safeLinks[0]?.href;

      // Avoid ~orig entirely to prevent 100MB+ JPEG or TIF buffering issues
      const imageUrl = medium || large || small || fallback || '';
      // Cards and the first view of the preview use the small size: sharp enough, and a fraction of the bytes
      const thumbnailUrl = small || thumb || medium || fallback || '';

      // Only what the library record says: it has no sol, location, instrument or resolution for its images
      return {
        id: itemData.nasa_id || `img-${Date.now()}-${index}`,
        nasaId: itemData.nasa_id || null,
        title: itemData.title || 'Untitled image',
        // Some library captions carry HTML links and line breaks: keep the text only
        description: (itemData.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'No description in the NASA Image and Video Library.',
        thumbnailUrl,
        imageUrl,
        instrument: null,
        mission: 'NASA Image Library',
        target: null,
        sol: null,
        earthDate: itemData.date_created ? itemData.date_created.split('T')[0] : null,
        dateKind: 'dated',
        category: 'NASA_API',
        tags: itemData.keywords || [],
        lat: null,
        lon: null,
        coordsNote: null,
        resolution: null,
        credit: itemData.photographer || itemData.secondary_creator || (itemData.center ? `NASA ${itemData.center}` : 'NASA'),
      };
    }).filter((img) => img.thumbnailUrl); // Only return items that actually have an image

    writeCache(key, items);
    return items;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    console.error('Error fetching NASA imagery:', error);
    return cached?.items || [];
  }
};

/** Warms the cache for a search in the background (used while the app is idle). */
export const prefetchImagery = (query) => {
  if (navigator.connection?.saveData) return;
  fetchMarsImagery(query).catch(() => {});
};

