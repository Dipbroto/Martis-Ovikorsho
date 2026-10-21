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

export function renderSlopeOverlay(grid, slope) {
  return paint(grid, (i) => {
    const s = slope[i];
    if (Number.isNaN(s)) return null;
    return SLOPE_CLASSES.find((k) => s >= k.min)?.rgba || null;
  });
}

/**
 * Lights up every cell the crew can still walk to and then back to base within the remaining
 * life-support budget (outbound + return cost); darkens the rest.
 */
export function renderReturnOverlay(grid, costToBase, costFromHere, remainingJ) {
  return paint(grid, (i) => {
    const roundTrip = costFromHere[i] + costToBase[i];
    if (!(roundTrip <= remainingJ) || remainingJ <= 0) return [5, 6, 8, 150];
    const share = roundTrip / remainingJ;
    if (share > 0.85) return [245, 158, 11, 200]; // last 15% of margin: the point-of-no-return band
    return [16, 185, 129, Math.round(85 + 70 * (1 - share))];
  });
}

export function renderCommsOverlay(grid, visible) {
  return paint(grid, (i) => (visible[i] ? [34, 211, 238, 55] : [127, 29, 29, 120]));
}
