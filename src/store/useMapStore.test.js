import { beforeEach, describe, expect, it, vi } from 'vitest';
import useMapStore from './useMapStore';

const store = () => useMapStore.getState();
// Each user action is its own step only once the grouping window has passed
const nextStep = () => vi.advanceTimersByTime(1000);
const undoAll = () => { while (store().undoDepth) store().undo(); };

describe('map undo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    undoAll();
    store().setRoverDriving(false);
    nextStep();
  });

  it('removes waypoints one step at a time', () => {
    store().addWaypoint({ lat: 1, lon: 1 });
    nextStep();
    store().addWaypoint({ lat: 2, lon: 2 });
    nextStep();
    store().undo();
    expect(store().waypoints.map((w) => w.lat)).toEqual([1]);
    store().undo();
    expect(store().waypoints).toEqual([]);
    expect(store().undoDepth).toBe(0);
  });

  it('brings back a route that was cleared', () => {
    store().addWaypoint({ lat: 1, lon: 1 });
    nextStep();
    store().clearWaypoints();
    nextStep();
    store().undo();
    expect(store().waypoints).toHaveLength(1);
  });

  it('undoes tools, overlays and selections, not only points', () => {
    store().setTerrainOverlay('slope');
    nextStep();
    store().setSelectedPOI({ id: 'a', name: 'A', lat: 0, lon: 0 });
    nextStep();
    store().undo();
    expect(store().selectedPOI).toBeNull();
    expect(store().terrainOverlay).toBe('slope');
    store().undo();
    expect(store().terrainOverlay).toBeNull();
  });

  it('keeps the updates of one action as one step', () => {
    store().setPlacingWaypoint(true);
    store().addWaypoint({ lat: 1, lon: 1 });
    nextStep();
    store().undo();
    expect(store().isPlacingWaypoint).toBe(false);
    expect(store().waypoints).toEqual([]);
    expect(store().undoDepth).toBe(0);
  });

  it('flies back to where the map was looking', () => {
    store().setViewCenter([10, 20], 5);
    store().flyToCoordinate(40, 50, 8);
    nextStep();
    store().undo();
    expect(store().mapCenter).toEqual([10, 20]);
    expect(store().mapZoom).toBe(5);
  });

  it('ignores a reset that changes nothing, and can undo one that does', () => {
    store().resetMapToDefault();
    nextStep();
    const depth = store().undoDepth;
    store().resetMapToDefault();
    nextStep();
    expect(store().undoDepth).toBe(depth);
    store().addWaypoint({ lat: 1, lon: 1 });
    nextStep();
    store().resetMapToDefault();
    nextStep();
    expect(store().waypoints).toEqual([]);
    store().undo();
    expect(store().waypoints).toHaveLength(1);
  });

  it('does not record panning or undo during a walk', () => {
    store().setViewCenter([1, 1], 3);
    nextStep();
    expect(store().undoDepth).toBe(0);
    store().addWaypoint({ lat: 1, lon: 1 });
    nextStep();
    store().setRoverDriving(true);
    store().undo();
    expect(store().waypoints).toHaveLength(1);
    store().setRoverDriving(false);
  });
});
