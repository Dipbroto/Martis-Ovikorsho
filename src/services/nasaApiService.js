import { ROCK_TARGETS } from '../data/rockTargets';

const NASA_IMAGE_API = 'https://images-api.nasa.gov';

/**
 * Fetches dynamic imagery from the NASA Image and Video Library API.
 */
export const fetchMarsImagery = async (query = 'Mars Perseverance', page = 1) => {
  try {
    const response = await fetch(`${NASA_IMAGE_API}/search?q=${encodeURIComponent(query)}&media_type=image&page=${page}`);
    if (!response.ok) throw new Error('NASA API request failed');
    
    const data = await response.json();
    
    // Map NASA API items to our app's imagery format
    const items = data.collection.items || [];
    return items.map((item, index) => {
      const itemData = item.data[0];
      const links = item.links || [];
      
      // Strictly filter for browser-friendly lightweight formats
      const safeLinks = links.filter(l => l.href.match(/\.(jpg|jpeg|png)$/i));
      
      const thumb = safeLinks.find(l => l.href.includes('~thumb'))?.href;
      const small = safeLinks.find(l => l.href.includes('~small'))?.href;
      const medium = safeLinks.find(l => l.href.includes('~medium'))?.href;
      const large = safeLinks.find(l => l.href.includes('~large'))?.href;
      const fallback = safeLinks.find(l => l.render === 'image')?.href || safeLinks[0]?.href;
      
      // Avoid ~orig entirely to prevent 100MB+ JPEG or TIF buffering issues
      const imageUrl = medium || large || small || fallback || '';
      const thumbnailUrl = thumb || small || medium || fallback || '';
      
      return {
        id: itemData.nasa_id || `img-${Date.now()}-${index}`,
        title: itemData.title || 'Unknown Observation',
        description: itemData.description || 'No description available from PDS.',
        thumbnailUrl: thumbnailUrl,
        imageUrl: imageUrl,
        camera: itemData.center || 'NASA PDS',
        instrument: itemData.keywords && itemData.keywords.length > 0 ? itemData.keywords[0] : 'Remote Sensing',
        mission: 'NASA Collection',
        target: 'Martian Surface',
        sol: null, // The NASA Image Library has no Martian sol; only the Earth date below is real
        earthDate: itemData.date_created ? itemData.date_created.split('T')[0] : 'Unknown Date',
        type: query.toLowerCase().includes('orbiter') || query.toLowerCase().includes('hirise') ? 'ORBITAL' : 'SURFACE',
        category: 'NASA_API',
        tags: itemData.keywords || ['mars', 'space'],
        // The library doesn't georeference its images, so don't invent a location
        lat: null,
        lon: null,
        elevation: null,
        ls: null,
        credit: 'NASA/JPL-Caltech/PDS',
        resolution: 'N/A'
      };
    }).filter(img => img.thumbnailUrl); // Only return items that actually have an image
  } catch (error) {
    console.error("Error fetching NASA imagery:", error);
    return [];
  }
};


/**
 * Returns the curated astrobiological science targets bundled with the app
 * (a stand-in for a PDS node query).
 */
export const fetchScienceTargets = async () => ROCK_TARGETS;
