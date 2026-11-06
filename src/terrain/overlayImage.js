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
  const px = img.data;
  // The column positions are the same on every row: work them out once
  const X0 = new Int32Array(OW), X1 = new Int32Array(OW), TX = new Float64Array(OW);
  for (let x = 0; x < OW; x++) {
    const fx = Math.min(W - 1, Math.max(0, (x + 0.5) / scale - 0.5));
    X0[x] = fx | 0;
    X1[x] = Math.min(W - 1, X0[x] + 1);
    TX[x] = fx - X0[x];
  }
  for (let y = 0; y < OH; y++) {
    const fy = Math.min(H - 1, Math.max(0, (y + 0.5) / scale - 0.5));
    const y0 = fy | 0, y1 = Math.min(H - 1, y0 + 1), ty = fy - y0;
    const r0 = y0 * W, r1 = y1 * W;
    let o = y * OW * 4;
    for (let x = 0; x < OW; x++, o += 4) {
      const tx = TX[x];
      const top = values[r0 + X0[x]] * (1 - tx) + values[r0 + X1[x]] * tx;
      const bottom = values[r1 + X0[x]] * (1 - tx) + values[r1 + X1[x]] * tx;
      const c = colorFor(top * (1 - ty) + bottom * ty);
      // four byte writes are much cheaper than a typed-array set() per pixel
      if (c) { px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3]; }
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
  // Fatal Martian void: deep obsidian abyss showing unrecoverable ground
  const FATAL_VOID = [8, 10, 18, 185];
  if (remainingJ <= 0) return paint(grid, () => FATAL_VOID);

  // Unreachable cells (Infinity) are capped just past the budget so edges interpolate cleanly
  const cap = remainingJ * 1.3;
  const values = new Float32Array(grid.width * grid.height);
  for (let i = 0; i < values.length; i++) {
    values[i] = Math.min(cap, costFromHere[i] + costToBase[i]);
  }

  // Colours are made once, not per pixel (this runs ~1.8 million times); the green alpha is filled in per call
  const OUTER_EDGE = [255, 30, 60, 245];
  const INNER_EDGE = [255, 30, 60, 255];
  const DANGER = [239, 68, 68, 205];
  const CAUTION = [245, 158, 11, 190];
  const SAFE = [16, 185, 129, 0];

  return paintSmooth(grid, values, (roundTrip) => {
    // 1. Outside life-support budget
    if (roundTrip > remainingJ) {
      // Outer fringe of the razor-sharp neon crimson contour (100% to 102.5%)
      if (roundTrip <= remainingJ * 1.025) {
        return OUTER_EDGE;
      }
      return FATAL_VOID;
    }

    // 2. Inside life-support budget: share of budget consumed
    const share = roundTrip / remainingJ;

    // Razor-sharp inner edge of the 100% boundary (96.5% to 100%)
    if (share >= 0.965) {
      return INNER_EDGE; // Razor-sharp neon crimson isochrone contour
    }

    // Critical Danger Band (82% to 96.5%): intense warning red
    if (share > 0.82) {
      return DANGER;
    }

    // Turn-Back Caution Margin (65% to 82%): tactical amber
    if (share > 0.65) {
      return CAUTION;
    }

    // Safe Return Zone (0% to 65%): luminous emerald green gradient
    SAFE[3] = Math.round(85 + 85 * (1 - (share / 0.65)));
    return SAFE;
  }, 3);
}

export function renderCommsOverlay(grid, visible) {
  const values = Float32Array.from(visible, (v) => (v ? 1 : 0));
  const SEEN = [34, 211, 238, 55];
  const HIDDEN = [127, 29, 29, 120];
  return paintSmooth(grid, values, (v) => (v >= 0.5 ? SEEN : HIDDEN));
}
