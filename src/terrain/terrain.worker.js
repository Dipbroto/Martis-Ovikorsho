// Runs the heavy terrain algorithms off the main thread.
import { planRoute, returnCostField, slopeField, viewshed } from './pathfinding';

const grids = new Map();

const handlers = {
  register: ({ grid }) => {
    grids.set(grid.id, grid);
    return true;
  },
  planRoute: ({ gridId, start, goal, options }) => planRoute(grids.get(gridId), start, goal, options),
  returnCostField: ({ gridId, base, options }) => returnCostField(grids.get(gridId), base, options),
  slopeField: ({ gridId }) => slopeField(grids.get(gridId)),
  viewshed: ({ gridId, observer, options }) => viewshed(grids.get(gridId), observer, options),
};

self.onmessage = ({ data: { id, type, payload } }) => {
  try {
    const result = handlers[type](payload);
    const transfer = result?.buffer instanceof ArrayBuffer ? [result.buffer] : [];
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message });
  }
};
