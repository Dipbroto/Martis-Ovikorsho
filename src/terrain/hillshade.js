// Shaded-relief image of a DEM grid: elevation picks a Mars colour, a low sun from the north-west
// shades the slopes. Used for the home page previews; the map itself uses orbital imagery.

const RAMP = [
  [0, [46, 18, 12]],
  [0.25, [104, 40, 22]],
  [0.5, [168, 78, 42]],
  [0.75, [208, 132, 84]],
  [1, [236, 196, 150]],
];

function rampColor(t) {
  for (let i = 1; i < RAMP.length; i++) {
    const [t1, c1] = RAMP[i];
    if (t <= t1) {
      const [t0, c0] = RAMP[i - 1];
      const k = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => c0[j] + (c1[j] - c0[j]) * k);
    }
  }
  return RAMP[RAMP.length - 1][1];
}

/**
 * Draws the grid into a new canvas, one pixel per cell.
 * `exaggeration` steepens the shading so 200 m cells still show gentle relief.
 */
export function renderHillshade(grid, { exaggeration = 4, azimuthDeg = 315, altitudeDeg = 40 } = {}) {
  const { width: W, height: H, data, nodata } = grid;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const z = data[i];
    if (z === nodata) continue;
    if (z < min) min = z;
    if (z > max) max = z;
  }
  const range = max - min || 1;
  const cell = grid.metersPerPixel;
  const az = (azimuthDeg * Math.PI) / 180;
  const alt = (altitudeDeg * Math.PI) / 180;
  const lx = Math.sin(az) * Math.cos(alt), ly = -Math.cos(az) * Math.cos(alt), lz = Math.sin(alt);
  const at = (c, r) => {
    const z = data[Math.min(H - 1, Math.max(0, r)) * W + Math.min(W - 1, Math.max(0, c))];
    return z === nodata ? min : z;
  };

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      const z = data[i];
      if (z === nodata) continue;
      const dzdx = ((at(c + 1, r) - at(c - 1, r)) / (2 * cell)) * exaggeration;
      const dzdy = ((at(c, r + 1) - at(c, r - 1)) / (2 * cell)) * exaggeration;
      const shade = Math.max(0, (-dzdx * lx - dzdy * ly + lz) / Math.hypot(dzdx, dzdy, 1));
      const light = 0.35 + 0.85 * shade;
      const [cr, cg, cb] = rampColor((z - min) / range);
      img.data[i * 4] = Math.min(255, cr * light);
      img.data[i * 4 + 1] = Math.min(255, cg * light);
      img.data[i * 4 + 2] = Math.min(255, cb * light);
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Grid pixel (fractional) for a lat/lon, and back. */
export const toPixel = (g, lat, lon) => ({
  x: ((lon - g.west) / (g.east - g.west)) * g.width,
  y: ((g.north - lat) / (g.north - g.south)) * g.height,
});
export const toLatLon = (g, x, y) => ({
  lat: g.north - (y / g.height) * (g.north - g.south),
  lon: g.west + (x / g.width) * (g.east - g.west),
});
