/**
 * NASA Planetary Imagery & Raw Rover Photos API Service
 * 
 * Provides unified access to:
 * 1. NASA Mars Raw Images API (mars.nasa.gov/rss/api/?feed=raw_images):
 *    Official high-frequency telemetry & in-situ raw frames for Perseverance & Curiosity,
 *    queried by exact Sol, Camera Instrument, and Optical Filter.
 * 2. NASA Image and Video Library API (images-api.nasa.gov):
 *    Curated orbital (HiRISE, Odyssey THEMIS), mission panoramas, and atmospheric observations.
 * 3. Offline Resilient Baseline (public/data/hero_rover_photos.json):
 *    Pre-cached authentic EDR frames across hero Martian sols (Sol 1000, 899, 500, 294, 190, 10, 4086).
 */

const NASA_IMAGE_API = 'https://images-api.nasa.gov';
const MARS_RAW_API = 'https://mars.nasa.gov/rss/api/?feed=raw_images&feedtype=json';

const CACHE_PREFIX = 'martis-nasa-v4:';
const CACHE_TTL_MS = 24 * 3600e3;
const PAGE_SIZE = 40;
const memory = new Map();

/**
 * Metadata for supported Mars surface rovers
 */
export const ROVER_METADATA = {
  perseverance: {
    id: 'perseverance',
    name: 'Perseverance (Mars 2020)',
    shortName: 'Perseverance',
    landingSite: 'Jezero Crater',
    coords: [18.4447, 77.4509],
    landingDate: '2021-02-18',
    maxSol: 2030,
    active: true,
    categoryKey: 'mars2020',
    color: '#fb923c',
    heroSols: [1000, 899, 500, 294, 190, 10],
  },
  curiosity: {
    id: 'curiosity',
    name: 'Curiosity (MSL)',
    shortName: 'Curiosity',
    landingSite: 'Gale Crater (Mount Sharp)',
    coords: [-4.5895, 137.4417],
    landingDate: '2012-08-06',
    maxSol: 4700,
    active: true,
    categoryKey: 'msl',
    color: '#38bdf8',
    heroSols: [4086, 3108, 1814, 1000, 50],
  },
};

/**
 * Camera instruments available for each rover
 */
export const ROVER_CAMERAS = {
  perseverance: [
    { id: 'ALL', label: 'All Instruments', shortName: 'ALL' },
    {
      id: 'MCZ_RIGHT',
      label: 'Mastcam-Z Right (28–100mm Zoom)',
      shortName: 'Mastcam-Z (R)',
      description: 'Mast-mounted multispectral stereo zoom camera for geological surveying, multispectral mineralogy, and color mosaics.',
      type: 'science',
    },
    {
      id: 'MCZ_LEFT',
      label: 'Mastcam-Z Left (Stereo Zoom)',
      shortName: 'Mastcam-Z (L)',
      description: 'Stereo zoom companion to Mastcam-Z Right for 3D digital elevation models and color science.',
      type: 'science',
    },
    {
      id: 'SUPERCAM_RMI',
      label: 'SuperCam Remote Micro-Imager (RMI)',
      shortName: 'SuperCam RMI',
      description: 'Telescopic micro-imager resolving sub-millimeter rock textures and crystal boundaries from up to 7 meters away.',
      type: 'science',
    },
    {
      id: 'SHERLOC_WATSON',
      label: 'SHERLOC WATSON (Arm Macro Camera)',
      shortName: 'WATSON',
      description: 'Wide Angle Topographic Sensor for Operations and eNgineering on the robotic arm turret for micro-scale borehole and abrasion analysis.',
      type: 'science',
    },
    {
      id: 'SHERLOC_ACI',
      label: 'SHERLOC ACI (Autofocus Context Imager)',
      shortName: 'SHERLOC ACI',
      description: 'Sub-micron scale context imager aligned with the SHERLOC deep-UV Raman laser spectrometer.',
      type: 'science',
    },
    {
      id: 'PIXL_MCC',
      label: 'PIXL Micro Context Camera (MCC)',
      shortName: 'PIXL MCC',
      description: 'Color optical micro-context camera co-aligned with the PIXL micro-XRF sensor beam.',
      type: 'science',
    },
    {
      id: 'NAVCAM_LEFT',
      label: 'Navigation Camera Left',
      shortName: 'Navcam (L)',
      description: 'Mast-mounted engineering stereo camera used by autonomous visual odometry for traverse planning.',
      type: 'engineering',
    },
    {
      id: 'NAVCAM_RIGHT',
      label: 'Navigation Camera Right',
      shortName: 'Navcam (R)',
      description: 'Right stereo navigation camera for 3D terrain hazard map generation.',
      type: 'engineering',
    },
    {
      id: 'FRONT_HAZCAM_LEFT_A',
      label: 'Front Hazcam Left',
      shortName: 'Front Hazcam (L)',
      description: 'Wide-angle fisheye lens mounted on lower front chassis to detect immediate rocks, drop-offs, and wheel hazards.',
      type: 'engineering',
    },
    {
      id: 'FRONT_HAZCAM_RIGHT_A',
      label: 'Front Hazcam Right',
      shortName: 'Front Hazcam (R)',
      description: 'Right front hazard avoidance camera.',
      type: 'engineering',
    },
    {
      id: 'REAR_HAZCAM_LEFT',
      label: 'Rear Hazcam Left',
      shortName: 'Rear Hazcam (L)',
      description: 'Wide-angle hazard camera for reversing and blind-spot clearance.',
      type: 'engineering',
    },
    {
      id: 'REAR_HAZCAM_RIGHT',
      label: 'Rear Hazcam Right',
      shortName: 'Rear Hazcam (R)',
      description: 'Right rear hazard avoidance camera.',
      type: 'engineering',
    },
    {
      id: 'SKYCAM',
      label: 'MEDA Skycam (Atmosphere & Sun)',
      shortName: 'MEDA Skycam',
      description: 'Upward-pointing sky camera measuring atmospheric dust optical depth (tau) and cloud morphology.',
      type: 'environmental',
    },
    {
      id: 'EDL_RDCAM',
      label: 'EDL Rover Down-Look Camera',
      shortName: 'EDL Down-Look',
      description: 'High-speed descent stage camera capturing the Martian ground rushing up during terminal descent.',
      type: 'edl',
    },
    {
      id: 'EDL_RUCAM',
      label: 'EDL Rover Up-Look Camera',
      shortName: 'EDL Up-Look',
      description: 'Upward-looking high-speed camera capturing parachute deployment and sky crane separation.',
      type: 'edl',
    },
  ],
  curiosity: [
    { id: 'ALL', label: 'All Instruments', shortName: 'ALL' },
    {
      id: 'MAST_LEFT',
      label: 'Mastcam Left (34mm Focal Length)',
      shortName: 'Mastcam (L)',
      description: '34mm focal length multispectral camera on the remote sensing mast.',
      type: 'science',
    },
    {
      id: 'MAST_RIGHT',
      label: 'Mastcam Right (100mm Telephoto)',
      shortName: 'Mastcam (R)',
      description: '100mm telephoto lens revealing fine layering on Mount Sharp and distant crater rims.',
      type: 'science',
    },
    {
      id: 'CHEMCAM',
      label: 'ChemCam Remote Micro-Imager',
      shortName: 'ChemCam RMI',
      description: 'Telescopic micro-imager coupled to the LIBS laser spectrometer.',
      type: 'science',
    },
    {
      id: 'MAHLI',
      label: 'Mars Hand Lens Imager (MAHLI)',
      shortName: 'MAHLI',
      description: 'Robotic arm color macro camera focusing from 2.1 cm to infinity for grain-scale mineralogy.',
      type: 'science',
    },
    {
      id: 'NAV_LEFT_B',
      label: 'Navigation Camera Left',
      shortName: 'Navcam (L)',
      description: 'Stereo navigation camera on mast for traverse planning.',
      type: 'engineering',
    },
    {
      id: 'NAV_RIGHT_B',
      label: 'Navigation Camera Right',
      shortName: 'Navcam (R)',
      description: 'Right stereo navigation camera.',
      type: 'engineering',
    },
    {
      id: 'MARDI',
      label: 'Mars Descent Imager (MARDI)',
      shortName: 'MARDI',
      description: 'Downward-pointing camera that recorded Curiosity descent into Gale Crater.',
      type: 'edl',
    },
    {
      id: 'FHAZ',
      label: 'Front Hazard Avoidance Cameras',
      shortName: 'Front Hazcam',
      description: 'Fisheye hazard detection cameras on the front chassis.',
      type: 'engineering',
    },
    {
      id: 'RHAZ',
      label: 'Rear Hazard Avoidance Cameras',
      shortName: 'Rear Hazcam',
      description: 'Rear chassis hazard cameras.',
      type: 'engineering',
    },
  ],
};

/**
 * Curated hero sol presets for instant exploration
 */
export const HERO_SOL_PRESETS = {
  perseverance: [
    { sol: 1000, label: 'Sol 1000: Delta Fan Margin (Mastcam-Z)', camera: 'MCZ_RIGHT', desc: 'Ancient river delta conglomerate boulders and gravel channels.' },
    { sol: 899, label: 'Sol 899: Jurabi Point Outcrop', camera: 'MCZ_RIGHT', desc: 'Prominent boulder field and fine laminated deltaic mudstones.' },
    { sol: 500, label: 'Sol 500: Delta Top Overview', camera: 'MCZ_LEFT', desc: 'High-vantage panoramic survey of Jezero Crater floor from delta rim.' },
    { sol: 294, label: 'Sol 294: Bellegarde & Quartier Core', camera: 'SHERLOC_WATSON', desc: 'Robotic arm WATSON inspection of olivine-rich volcanic core sample #1.' },
    { sol: 190, label: 'Sol 190: Montdenier First Sample', camera: 'MCZ_RIGHT', desc: 'Perseverance historic first sealed rock core in Jezero Crater.' },
    { sol: 10, label: 'Sol 10: EDL Sky Crane Descent', camera: 'EDL_RDCAM', desc: 'Dust plume kicked up by descent stage retrorockets during touchdown.' },
  ],
  curiosity: [
    { sol: 4086, label: 'Sol 4086: Mount Sharp Navcam Selfie', camera: 'NAV_LEFT_B', desc: 'Iconic polar projection 36-frame selfie below the sulfate-bearing unit.' },
    { sol: 3108, label: 'Sol 3108: Mont Mercou Cliff Panorama', camera: 'MAST_LEFT', desc: 'Spectacular 6-meter-high layered sedimentary cliff exposure.' },
    { sol: 1814, label: 'Sol 1814: Vera Rubin Ridge Hematite', camera: 'MAST_LEFT', desc: 'Steep hematite-rich ridge during the September 2017 solar flare event.' },
    { sol: 1000, label: 'Sol 1000: Mount Sharp Lower Slopes', camera: 'MAST_LEFT', desc: 'Milestone 1,000-sol survey of Gale Crater mudstones and cross-bedding.' },
    { sol: 50, label: 'Sol 50: Rocknest Windblown Ripple', camera: 'MAST_RIGHT', desc: 'First scooping of Martian eolian soil and ChemCam interrogation.' },
  ],
};

function ensureHttps(url) {
  if (!url || typeof url !== 'string') return '';
  return url.replace(/^http:\/\//i, 'https://');
}

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
    localStorage.setItem(
      key,
      JSON.stringify({
        at: entry.at,
        items: items.map((i) => ({ ...i, description: i.description?.slice(0, 700) })),
      })
    );
  } catch {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_PREFIX))
        .slice(0, 8)
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}

let cachedHeroJson = null;
async function getHeroFallbackPhotos(rover, sol, camera) {
  try {
    if (!cachedHeroJson) {
      const resp = await fetch('/data/hero_rover_photos.json');
      if (resp.ok) {
        cachedHeroJson = await resp.json();
      }
    }
    if (!cachedHeroJson?.photos) return [];
    return cachedHeroJson.photos.filter((p) => {
      const matchRover = !rover || p.rover === rover.toLowerCase();
      const matchSol = sol == null || p.sol === Number(sol);
      const matchCam = !camera || camera === 'ALL' || p.camera === camera;
      return matchRover && matchSol && matchCam;
    });
  } catch {
    return [];
  }
}

/**
 * Fetches in-situ raw rover photos from NASA Mars Raw Images API by Sol and Camera.
 * 
 * Supports:
 * - rover: 'perseverance' | 'curiosity'
 * - sol: integer sol number
 * - camera: specific instrument code (e.g. 'MCZ_RIGHT', 'SUPERCAM_RMI', 'SHERLOC_WATSON', 'NAVCAM_LEFT') or 'ALL'
 * - page: page number (default 1)
 */
export async function fetchMarsRoverPhotos({
  rover = 'perseverance',
  sol = 1000,
  camera = 'ALL',
  page = 1,
  signal,
} = {}) {
  const roverKey = rover.toLowerCase();
  const roverMeta = ROVER_METADATA[roverKey] || ROVER_METADATA.perseverance;
  const camerasList = ROVER_CAMERAS[roverKey] || ROVER_CAMERAS.perseverance;
  const key = `${CACHE_PREFIX}rover:${roverKey}:sol${sol}:${camera}:p${page}`;

  const cached = readCache(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.items;
  }

  try {
    const category = roverMeta.categoryKey;
    const cameraQuery = camera && camera !== 'ALL' ? `&search=${encodeURIComponent(camera)}` : '';
    const num = PAGE_SIZE;
    const url = `${MARS_RAW_API}&category=${category}&sol=${sol}${cameraQuery}&page=${page - 1}&num=${num}`;

    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`NASA Raw Images API error: ${response.status}`);

    const data = await response.json();
    const rawImages = data.images || [];

    let items = rawImages.map((img, idx) => {
      const camObj = img.camera || {};
      const instrumentCode = camObj.instrument || camera || 'CAMERA';
      const camMeta = camerasList.find((c) => c.id === instrumentCode) || {
        id: instrumentCode,
        label: instrumentCode,
        shortName: instrumentCode,
        description: `Instrument frame from ${roverMeta.name}`,
      };

      const files = img.image_files || {};
      const small = ensureHttps(files.small || files.medium || files.full_res);
      const medium = ensureHttps(files.medium || files.large || files.full_res);
      const large = ensureHttps(files.large || files.full_res || files.medium);
      const fullRes = ensureHttps(files.full_res || large);

      const dateUtc = img.date_taken_utc || img.date_received || '';
      const earthDate = dateUtc.includes('T') ? dateUtc.split('T')[0] : dateUtc;
      const filterName = camObj.filter_name && camObj.filter_name !== 'UNK' ? camObj.filter_name : 'BROADBAND';

      const description =
        img.caption ||
        `Raw optical frame captured by ${roverMeta.name} ${camMeta.label} on Sol ${sol}. Optical filter: ${filterName}. Transmission received via NASA Deep Space Network.`;

      return {
        id: `nasa-rover-${roverKey}-${img.imageid || `${sol}-${idx}`}`,
        nasaId: img.imageid ? `M2020_${img.imageid}` : null,
        title: img.title || `${roverMeta.name} Sol ${sol}: ${camMeta.label}`,
        description,
        thumbnailUrl: small || medium,
        imageUrl: large || medium || small,
        fullResUrl: fullRes,
        sol: Number(img.sol ?? sol),
        earthDate,
        dateKind: 'taken',
        mission: roverMeta.name,
        rover: roverKey,
        instrument: `${camMeta.label} (${instrumentCode})`,
        cameraName: instrumentCode,
        cameraShort: camMeta.shortName,
        filterName,
        category: 'rover',
        tags: [roverMeta.shortName, camMeta.shortName, `Sol ${sol}`, 'Raw NASA Imager', 'In-Situ'],
        lat: roverMeta.coords[0],
        lon: roverMeta.coords[1],
        coordsNote: 'site',
        credit: img.credit || 'NASA/JPL-Caltech',
        drive: img.drive,
        site: img.site,
        attitude: img.attitude,
        cameraVector: camObj.camera_vector,
        resolution: files.large ? '1200 x 800 px (EDR Browse)' : 'Standard EDR',
      };
    }).filter((img) => img.thumbnailUrl);

    // If API returned 0 matching results for this camera/sol, check offline hero backup
    if (items.length === 0) {
      const fallback = await getHeroFallbackPhotos(roverKey, sol, camera);
      if (fallback.length > 0) items = fallback;
    }

    if (items.length > 0) {
      writeCache(key, items);
    }
    return items;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    console.warn(`NASA Mars Rover Photos network request failed for ${roverKey} Sol ${sol}:`, error);

    // Try offline hero backup before returning empty
    const fallback = await getHeroFallbackPhotos(roverKey, sol, camera);
    if (fallback.length > 0) return fallback;

    return cached?.items || [];
  }
}

/**
 * Results already fetched for a search, or null.
 */
export function getCachedImagery(query = 'Mars Perseverance', page = 1) {
  const hit = readCache(`${CACHE_PREFIX}${page}:${query.trim().toLowerCase()}`);
  return hit ? { items: hit.items, fresh: Date.now() - hit.at < CACHE_TTL_MS } : null;
}

/**
 * Fetches imagery from the NASA Image and Video Library API (images-api.nasa.gov).
 * Used for orbital HiRISE, mission panoramas, and atmospheric observations.
 */
export const fetchMarsImagery = async (query = 'Mars Perseverance', page = 1, { signal } = {}) => {
  const key = `${CACHE_PREFIX}${page}:${query.trim().toLowerCase()}`;
  const cached = getCachedImagery(query, page);
  if (cached?.fresh) return cached.items;
  try {
    const response = await fetch(
      `${NASA_IMAGE_API}/search?q=${encodeURIComponent(query)}&media_type=image&page=${page}&page_size=${PAGE_SIZE}`,
      { signal }
    );
    if (!response.ok) throw new Error('NASA API request failed');

    const data = await response.json();

    const items = (data.collection.items || [])
      .map((item, index) => {
        const itemData = item.data[0];
        const links = item.links || [];

        const safeLinks = links.filter((l) => l.href.match(/\.(jpg|jpeg|png)$/i));

        const thumb = safeLinks.find((l) => l.href.includes('~thumb'))?.href;
        const small = safeLinks.find((l) => l.href.includes('~small'))?.href;
        const medium = safeLinks.find((l) => l.href.includes('~medium'))?.href;
        const large = safeLinks.find((l) => l.href.includes('~large'))?.href;
        const fallback = safeLinks.find((l) => l.render === 'image')?.href || safeLinks[0]?.href;

        const imageUrl = ensureHttps(medium || large || small || fallback || '');
        const thumbnailUrl = ensureHttps(small || thumb || medium || fallback || '');

        return {
          id: itemData.nasa_id || `img-${Date.now()}-${index}`,
          nasaId: itemData.nasa_id || null,
          title: itemData.title || 'Untitled image',
          description:
            (itemData.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ||
            'No description in the NASA Image and Video Library.',
          thumbnailUrl,
          imageUrl,
          fullResUrl: imageUrl,
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
      })
      .filter((img) => img.thumbnailUrl);

    writeCache(key, items);
    return items;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    console.error('Error fetching NASA imagery:', error);
    return cached?.items || [];
  }
};

/**
 * Warms the cache for a search in the background (used while the app is idle).
 */
export const prefetchImagery = (query) => {
  if (navigator.connection?.saveData) return;
  fetchMarsImagery(query).catch(() => {});
};
