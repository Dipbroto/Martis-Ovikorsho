import { describe, expect, it, vi } from 'vitest';

vi.mock('../store/useMapStore', () => ({ default: { getState: () => ({}) }, routeSignature: () => '' }));
vi.mock('../utils/autonomousRouter', () => ({ AUTONOMOUS_TARGET_PAIRS: [], generateAutonomousTraverse: async () => ({}) }));
vi.mock('../terrain/dem', () => ({ loadDemIndex: async () => ({ grids: [] }), gridContains: () => false }));

const { routeFitBounds } = await import('./routePlanningService');

describe('routeFitBounds', () => {
  it('frames all of a route that stays on the map', () => {
    expect(routeFitBounds([[10, -50], [20, -30], [15, -10]])).toEqual([[10, -50], [20, -10]]);
  });

  it('frames the part a crossing route starts on', () => {
    expect(routeFitBounds([[18, -134], [18, -179], [10, 179], [5, 135]])).toEqual([[14, -180], [18, -127]]);
  });

  it('shows some map around a start right next to the line', () => {
    const [[, west], [, east]] = routeFitBounds([[0, 179], [0, -179]]);
    expect(west).toBeLessThan(179);
    expect(east).toBe(180);
    expect(east - west).toBeGreaterThan(29);
  });
});
