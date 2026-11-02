import { describe, expect, it, vi } from 'vitest';

const site = { id: 'olympus', west: -134.65, east: -133.05, south: 17.65, north: 19.25, metersPerPixel: 200 };
const global = { id: 'global', west: -180, east: 180, south: -90, north: 90, metersPerPixel: 15000 };

vi.mock('./dem', () => ({
  MAX_ROUTE_KM: 800,
  ensureTerrainFor: async () => {},
  ensureRemoteGrid: async () => { throw new Error('offline'); },
  gridContains: (g, lat, lon) => lat >= g.south && lat <= g.north && lon >= g.west && lon <= g.east,
  getGridAt: (lat, lon, { siteOnly = false } = {}) => (lat >= site.south && lat <= site.north && lon >= site.west && lon <= site.east ? site : siteOnly ? null : global),
  getLoadedGrid: (id) => (id === 'global' ? global : null),
}));

const { gridForPoints } = await import('./terrainClient');

describe('gridForPoints', () => {
  const olympus = { lat: 18.65, lon: -133.8 };

  it('stays on a site grid when every point is inside it', async () => {
    expect((await gridForPoints([olympus, { lat: 18, lon: -134 }])).id).toBe('olympus');
  });

  it('uses the global grid for a long route that starts on a site grid', async () => {
    expect((await gridForPoints([olympus, { lat: 0, lon: -60 }])).id).toBe('global');
  });
});
