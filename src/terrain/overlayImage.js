// Turns terrain analysis fields into transparent PNG overlays aligned with the grid bounds.

const SLOPE_CLASSES = [
  { min: 20, rgba: [220, 38, 38, 170] },   // steeper than the walkable limit
  { min: 15, rgba: [249, 115, 22, 140] },
  { min: 10, rgba: [234, 179, 8, 95] },
];

export function paint(grid, colorAt) {
  const canvas = document.createElement('canvas');
  canvas.width = grid.width;
  canvas.height = grid.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(grid.width, grid.height);
  for (let i = 0; i < grid.width * grid.height; i++) {
    const c = colorAt(i);
    if (!c) continue;
    img.data.set(c, i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Like `paint`, but samples a per-cell value field at `scale`x resolution with bilinear interpolation,
 * so zone edges come out as smooth contours instead of 200 m staircase blocks.
 */
function paintSmooth(grid, values, colorFor, scale = 3) {
  const W = grid.width, H = grid.height, OW = W * scale, OH = H * scale;
  const canvas = document.createElement('canvas');
  canvas.width = OW;
  canvas.height = OH;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(OW, OH);
  for (let y = 0; y < OH; y++) {
    const fy = Math.min(H - 1, Math.max(0, (y + 0.5) / scale - 0.5));
    const y0 = fy | 0, y1 = Math.min(H - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < OW; x++) {
      const fx = Math.min(W - 1, Math.max(0, (x + 0.5) / scale - 0.5));
      const x0 = fx | 0, x1 = Math.min(W - 1, x0 + 1), tx = fx - x0;
      const top = values[y0 * W + x0] * (1 - tx) + values[y0 * W + x1] * tx;
      const bottom = values[y1 * W + x0] * (1 - tx) + values[y1 * W + x1] * tx;
      const c = colorFor(top * (1 - ty) + bottom * ty);
      if (c) img.data.set(c, (y * OW + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export function renderSlopeOverlay(grid, slope) {
  const values = Float32Array.from(slope, (v) => (Number.isNaN(v) ? 0 : v));
  return paintSmooth(grid, values, (s) => SLOPE_CLASSES.find((k) => s >= k.min)?.rgba || null);
}

/**
 * Lights up every cell the crew can still walk to and then back to base within the remaining
 * life-support budget (outbound + return cost); darkens the rest.
 */
export function renderReturnOverlay(grid, costToBase, costFromHere, remainingJ) {
  const OUT_OF_REACH = [5, 6, 8, 150];
  if (remainingJ <= 0) return paint(grid, () => OUT_OF_REACH);
  // Unreachable cells (Infinity) are capped just past the budget so edges interpolate cleanly
  const cap = remainingJ * 1.25;
  const values = new Float32Array(grid.width * grid.height);
  for (let i = 0; i < values.length; i++) values[i] = Math.min(cap, costFromHere[i] + costToBase[i]);
  return paintSmooth(grid, values, (roundTrip) => {
    if (!(roundTrip <= remainingJ)) return OUT_OF_REACH;
    const share = roundTrip / remainingJ;
    if (share > 0.85) return [245, 158, 11, 200]; // last 15% of margin: the point-of-no-return band
    return [16, 185, 129, Math.round(85 + 70 * (1 - share))];
  });
}

export function renderCommsOverlay(grid, visible) {
  const values = Float32Array.from(visible, (v) => (v ? 1 : 0));
  return paintSmooth(grid, values, (v) => (v >= 0.5 ? [34, 211, 238, 55] : [127, 29, 29, 120]));
}
