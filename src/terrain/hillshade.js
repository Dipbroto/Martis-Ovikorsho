// Shaded-relief image of a DEM grid: elevation picks a Mars colour, a low sun from the north-west
// shades the slopes. Used for the home page previews; the map itself uses orbital imagery.

const RAMP = [
  [0, [46, 18, 12]],
  [0.25, [104, 40, 22]],
  [0.5, [168, 78, 42]],
  [0.75, [208, 132, 84]],
  [1, [236, 196, 150]],
];

// Writes the ramp colour for t into out[0..2]. No arrays are created: this runs once per pixel,
// about a million times for the global grid, and per-pixel allocations made the home page stutter.
function rampColorInto(t, out) {
  for (let i = 1; i < RAMP.length; i++) {
    const t1 = RAMP[i][0];
    if (t <= t1) {
      const t0 = RAMP[i - 1][0];
      const c0 = RAMP[i - 1][1];
      const c1 = RAMP[i][1];
      const k = (t - t0) / (t1 - t0);
      out[0] = c0[0] + (c1[0] - c0[0]) * k;
      out[1] = c0[1] + (c1[1] - c0[1]) * k;
      out[2] = c0[2] + (c1[2] - c0[2]) * k;
      return out;
    }
  }
  const last = RAMP[RAMP.length - 1][1];
  out[0] = last[0]; out[1] = last[1]; out[2] = last[2];
  return out;
}

/**
 * Draws the grid into a new canvas, one pixel per cell.
 * `exaggeration` steepens the shading so 200 m cells still show gentle relief.
 * `tint` ([r, g, b]) shades one colour instead of colouring by elevation.
 */
export function renderHillshade(grid, { exaggeration = 4, azimuthDeg = 315, altitudeDeg = 40, tint = null } = {}) {
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
  // neighbour height, edges clamped and holes read as the lowest height
  const val = (idx) => {
    const z = data[idx];
    return z === nodata ? min : z;
  };

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const px = img.data;
  const color = tint ? [tint[0], tint[1], tint[2]] : [0, 0, 0];
  const twoCell = 2 * cell;
  for (let r = 0; r < H; r++) {
    const row = r * W;
    const rowUp = (r > 0 ? r - 1 : 0) * W;
    const rowDown = (r < H - 1 ? r + 1 : H - 1) * W;
    for (let c = 0; c < W; c++) {
      const i = row + c;
      const z = data[i];
      if (z === nodata) continue;
      const cLeft = c > 0 ? c - 1 : 0;
      const cRight = c < W - 1 ? c + 1 : W - 1;
      const dzdx = ((val(row + cRight) - val(row + cLeft)) / twoCell) * exaggeration;
      const dzdy = ((val(rowDown + c) - val(rowUp + c)) / twoCell) * exaggeration;
      const shade = Math.max(0, (-dzdx * lx - dzdy * ly + lz) / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1));
      const light = 0.35 + 0.85 * shade;
      if (!tint) rampColorInto((z - min) / range, color);
      const o = i * 4;
      px[o] = Math.min(255, color[0] * light);
      px[o + 1] = Math.min(255, color[1] * light);
      px[o + 2] = Math.min(255, color[2] * light);
      px[o + 3] = 255;
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
