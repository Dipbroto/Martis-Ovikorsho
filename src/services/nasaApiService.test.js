import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ROVER_METADATA,
  ROVER_CAMERAS,
  HERO_SOL_PRESETS,
  fetchMarsRoverPhotos,
  getCachedImagery,
} from './nasaApiService';

describe('NASA Mars Rover Photos API Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes authentic rover metadata for Perseverance and Curiosity', () => {
    expect(ROVER_METADATA.perseverance).toBeDefined();
    expect(ROVER_METADATA.perseverance.name).toContain('Perseverance');
    expect(ROVER_METADATA.perseverance.landingSite).toBe('Jezero Crater');
    expect(ROVER_METADATA.perseverance.coords).toEqual([18.4447, 77.4509]);

    expect(ROVER_METADATA.curiosity).toBeDefined();
    expect(ROVER_METADATA.curiosity.name).toContain('Curiosity');
    expect(ROVER_METADATA.curiosity.landingSite).toContain('Gale Crater');
    expect(ROVER_METADATA.curiosity.coords[0]).toBeCloseTo(-4.5895, 2);
  });

  it('exposes instrument camera suites including Mastcam-Z, RMI, and WATSON', () => {
    const pCams = ROVER_CAMERAS.perseverance.map((c) => c.id);
    expect(pCams).toContain('MCZ_RIGHT');
    expect(pCams).toContain('MCZ_LEFT');
    expect(pCams).toContain('SUPERCAM_RMI');
    expect(pCams).toContain('SHERLOC_WATSON');
    expect(pCams).toContain('SHERLOC_ACI');
    expect(pCams).toContain('NAVCAM_LEFT');
    expect(pCams).toContain('FRONT_HAZCAM_LEFT_A');
    expect(pCams).toContain('SKYCAM');

    const cCams = ROVER_CAMERAS.curiosity.map((c) => c.id);
    expect(cCams).toContain('MAST_LEFT');
    expect(cCams).toContain('MAST_RIGHT');
    expect(cCams).toContain('CHEMCAM');
    expect(cCams).toContain('MAHLI');
    expect(cCams).toContain('NAV_LEFT_B');
  });

  it('provides hero sol presets for fast exploration', () => {
    expect(HERO_SOL_PRESETS.perseverance.length).toBeGreaterThanOrEqual(5);
    const sols = HERO_SOL_PRESETS.perseverance.map((p) => p.sol);
    expect(sols).toContain(1000);
    expect(sols).toContain(294);
    expect(sols).toContain(190);
  });

  it('fetches raw rover photos from NASA Mars Raw Images API and converts HTTP to HTTPS', async () => {
    const mockApiResponse = {
      images: [
        {
          imageid: '12345',
          sol: 1000,
          title: 'Mars Perseverance Sol 1000: Right Mastcam-Z Camera',
          camera: {
            instrument: 'MCZ_RIGHT',
            filter_name: 'ZCAM_R7_880NM_ND5',
            camera_vector: '(0.71, -0.05, -0.69)',
          },
          image_files: {
            small: 'http://mars.nasa.gov/test_small.jpg',
            medium: 'http://mars.nasa.gov/test_medium.jpg',
            large: 'http://mars.nasa.gov/test_large.jpg',
            full_res: 'http://mars.nasa.gov/test_full.png',
          },
          date_taken_utc: '2023-12-13T05:25:33.000',
          credit: 'NASA/JPL-Caltech/ASU/MSSS',
          drive: 44,
          site: 47,
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const items = await fetchMarsRoverPhotos({ rover: 'perseverance', sol: 1000, camera: 'MCZ_RIGHT' });
    expect(items).toHaveLength(1);

    const first = items[0];
    expect(first.sol).toBe(1000);
    expect(first.cameraName).toBe('MCZ_RIGHT');
    expect(first.filterName).toBe('ZCAM_R7_880NM_ND5');
    expect(first.thumbnailUrl).toBe('https://mars.nasa.gov/test_small.jpg');
    expect(first.imageUrl).toBe('https://mars.nasa.gov/test_large.jpg');
    expect(first.fullResUrl).toBe('https://mars.nasa.gov/test_full.png');
    expect(first.lat).toBe(18.4447);
    expect(first.lon).toBe(77.4509);
    expect(first.mission).toContain('Perseverance');
  });

  it('gracefully falls back to offline hero rover photos when network fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const items = await fetchMarsRoverPhotos({ rover: 'perseverance', sol: 1000, camera: 'MCZ_RIGHT' });
    expect(Array.isArray(items)).toBe(true);
  });
});
