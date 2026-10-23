import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Real NASA imagery streamed onto the globe as you zoom in, the same layers as the 2D map:
//   THEMIS daytime infrared (100 m/px) gives the detail, the Viking colour mosaic gives the colour,
//   and the HRSC-MOLA hillshade is blended in as light and shadow.
// The whole planet always shows the 4k base texture. Once the camera is close enough that the base would
// look soft, square tiles of the finer imagery fade in over the part you are looking at, and finer ones
// replace them as you go closer. Tiles use the Trek WMTS scheme: zoom z has 2^(z+1) x 2^z tiles of
// 180/2^z degrees, row 0 at the north pole and column 0 at longitude -180.

const R = 2;
const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const THEMIS = `${TREK}/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm`;
const VIKING = `${TREK}/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm`;
const SHADE = `${TREK}/Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw/1.0.0/default/default028mm`;
const MIN_Z = 4; // below this the base texture is as sharp as the tiles would be
const MAX_Z = 9; // THEMIS native resolution
const MIN_LEVEL = 3; // the coarsest ring of tiles
const MAX_RING = 26;
const PARALLEL = 4; // tiles being fetched at once; each is three images
const SUPERSAMPLE = 1; // tile pixels per screen pixel; 1 is pixel for pixel

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// ---------- imagery ----------

const images = new Map(); // url -> Promise<HTMLImageElement | null>
function loadImage(url) {
  if (!images.has(url)) {
    images.set(url, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // no image there (THEMIS stops near the poles)
      img.src = url;
    }));
    if (images.size > 600) images.delete(images.keys().next().value);
  }
  return images.get(url);
}

/** A tile of a layer that only goes down to `maxZ`: the tile itself, or the part of its ancestor that covers it. */
async function layerTile(base, ext, maxZ, z, x, y) {
  const zz = Math.min(z, maxZ);
  const shift = z - zz;
  const tx = x >> shift;
  const ty = y >> shift;
  const img = await loadImage(`${base}/${zz}/${ty}/${tx}.${ext}`);
  if (!img) return null;
  const n = 2 ** shift;
  const size = img.width / n;
  return { img, sx: (x - tx * n) * size, sy: (y - ty * n) * size, size };
}

async function composeTile(z, x, y) {
  const [themis, viking, shade] = await Promise.all([
    layerTile(THEMIS, 'png', 9, z, x, y),
    layerTile(VIKING, 'jpg', 7, z, x, y),
    layerTile(SHADE, 'png', 7, z, x, y),
  ]);
  if (!themis && !viking) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const draw = (t) => ctx.drawImage(t.img, t.sx, t.sy, t.size, t.size, 0, 0, 256, 256);
  if (viking) draw(viking); // colour
  if (themis) { ctx.globalCompositeOperation = viking ? 'luminosity' : 'source-over'; draw(themis); } // detail
  if (shade) { // light and shadow, the same grading as the 2D map
    ctx.globalCompositeOperation = 'soft-light';
    ctx.filter = 'brightness(0.71) contrast(3.2)';
    draw(shade);
    ctx.filter = 'none';
  }
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

// ---------- tile geometry ----------

const key = (z, x, y) => `${z}/${x}/${y}`;

function tileGeometry(z, x, y) {
  const t = 180 / 2 ** z;
  const lonW = -180 + x * t;
  const latN = 90 - y * t;
  const segs = Math.min(14, Math.max(4, Math.ceil(t / 1.1)));
  // three.js's sphere puts longitude -180 at phi = 0 and the north pole at theta = 0, which is how the globe is built
  return new THREE.SphereGeometry(R, segs, segs, rad(lonW + 180), rad(t), rad(90 - latN), rad(t));
}

const _v = new THREE.Vector3();
const _c = new THREE.Vector3();

/**
 * Tiles of zoom z in a ring between `inner` and `outer` degrees from the point under the camera, keeping
 * those whose centre projects inside the view.
 */
function ringTiles(z, lat, lon, outer, inner, viewRadius, camera) {
  const t = 180 / 2 ** z;
  const out = [];
  const cols = 2 ** (z + 1);
  const rows = 2 ** z;
  const y0 = Math.max(0, Math.floor((90 - (lat + outer + t)) / t));
  const y1 = Math.min(rows - 1, Math.floor((90 - (lat - outer - t)) / t));
  const cosLat = Math.max(0.05, Math.cos(rad(Math.min(88, Math.abs(lat) + outer * 0.5))));
  const span = Math.min(180, (outer + t) / cosLat);
  const x0 = Math.floor((lon - span + 180) / t);
  const x1 = Math.floor((lon + span + 180) / t);
  for (let y = y0; y <= y1; y++) {
    for (let xi = x0; xi <= x1; xi++) {
      const x = ((xi % cols) + cols) % cols;
      const clat = 90 - (y + 0.5) * t;
      const clon = -180 + (x + 0.5) * t;
      // angular distance from the view centre to the tile centre
      const a = Math.sin(rad(lat)) * Math.sin(rad(clat)) + Math.cos(rad(lat)) * Math.cos(rad(clat)) * Math.cos(rad(lon - clon));
      const d = deg(Math.acos(Math.min(1, Math.max(-1, a))));
      if (d > outer + t * 0.72 || d < inner) continue;
      // on the screen (with a tile's worth of margin) and not behind the planet
      _v.set(R * Math.cos(rad(clat)) * Math.cos(rad(clon)), R * Math.sin(rad(clat)), -R * Math.cos(rad(clat)) * Math.sin(rad(clon)));
      if (_v.clone().normalize().dot(_c.copy(camera.position).normalize()) < Math.cos(rad(Math.min(88, viewRadius + t)))) continue;
      const ndc = _v.project(camera);
      const margin = 1.15 + (t * 0.9) / Math.max(10, viewRadius);
      if (Math.abs(ndc.x) > margin || Math.abs(ndc.y) > margin) continue;
      out.push({ z, x, y, d });
    }
  }
  return out.sort((a, b) => a.d - b.d).slice(0, MAX_RING);
}

/** Graduated detail: the finest zoom in the middle, one coarser around it, two coarser toward the edges. */
function wanted(z, lat, lon, viewRadius, camera) {
  const out = [];
  let inner = 0;
  for (let k = 0; k < 3 && z - k >= MIN_LEVEL; k++) {
    const level = z - k;
    const t = 180 / 2 ** level;
    const outer = k === 2 ? viewRadius : Math.min(viewRadius, 2.6 * t);
    out.push(...ringTiles(level, lat, lon, outer, k === 0 ? 0 : inner - t * 0.8, viewRadius, camera));
    inner = outer;
    if (outer >= viewRadius) break;
  }
  return out;
}

/**
 * The detail layer. It reads the camera every so often (not every frame), works out which tiles the screen
 * needs, and keeps the loaded ones in a group over the globe. `onStatus({ z, loading })` reports progress.
 */
export default function DetailTiles({ onStatus }) {
  const { camera, size, scene } = useThree();
  const group = useRef(null);
  const tiles = useRef(new Map()); // key -> { z, mesh, state, fade }
  const last = useRef({ at: 0, pos: new THREE.Vector3(), dirty: true });
  const status = useRef({ z: 0, loading: 0 });

  useEffect(() => {
    const g = new THREE.Group();
    g.name = 'detail-tiles';
    scene.add(g);
    group.current = g;
    const all = tiles.current;
    return () => {
      all.forEach((t) => { t.mesh.geometry.dispose(); t.mesh.material.map?.dispose(); t.mesh.material.dispose(); });
      all.clear();
      scene.remove(g);
      group.current = null;
    };
  }, [scene]);

  const spawn = (z, x, y) => {
    const k = key(z, x, y);
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, transparent: true, opacity: 0, depthWrite: true });
    const mesh = new THREE.Mesh(tileGeometry(z, x, y), mat);
    mesh.scale.setScalar(1.0004 + z * 0.00003); // just above the base globe, finer tiles above coarser ones
    mesh.visible = false;
    mesh.renderOrder = z;
    group.current.add(mesh);
    const tile = { z, x, y, mesh, state: 'queued', fade: 0, d: 0, k };
    tiles.current.set(k, tile);
    return tile;
  };

  // Fetch the nearest wanted tiles first, a few at a time, and never ones nobody wants any more
  const inFlight = useRef(0);
  const wantedKeys = useRef(new Set());
  const pump = () => {
    while (inFlight.current < PARALLEL) {
      let next = null;
      tiles.current.forEach((t) => { if (t.state === 'queued' && wantedKeys.current.has(t.k) && (!next || t.d < next.d)) next = t; });
      if (!next) return;
      const tile = next;
      tile.state = 'loading';
      inFlight.current += 1;
      composeTile(tile.z, tile.x, tile.y).then((canvas) => {
        inFlight.current -= 1;
        if (tiles.current.get(tile.k) === tile) {
          if (!canvas) {
            tile.state = 'empty';
          } else {
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            tex.needsUpdate = true;
            tile.mesh.material.map = tex;
            tile.mesh.material.needsUpdate = true;
            tile.mesh.visible = true;
            tile.state = 'ready';
          }
        }
        last.current.dirty = true; // look again: older tiles can go once everything needed has loaded
        pump();
      });
    }
  };

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    // fade tiles in as they become ready
    tiles.current.forEach((t) => {
      if (t.state === 'ready' && t.fade < 1) {
        t.fade = Math.min(1, t.fade + dt * 3.2);
        t.mesh.material.opacity = t.fade;
        if (t.fade >= 1) t.mesh.material.transparent = false;
      }
    });

    const now = performance.now();
    const L = last.current;
    if (now - L.at < 180) return;
    const moved = camera.position.distanceToSquared(L.pos) > 1e-5;
    if (!moved && !L.dirty && status.current.loading === 0) return;
    L.at = now;
    L.dirty = false;
    L.pos.copy(camera.position);

    // Which zoom does the screen need? Pixels per degree of surface under the camera, against a tile's own.
    const d = camera.position.length();
    const alt = Math.max(0.03, d - R);
    const ppd = ((size.height / 2) / (Math.tan(rad(camera.fov) / 2) * alt)) * ((R * Math.PI) / 180) * (window.devicePixelRatio > 1.5 ? 1.5 : 1);
    const z = Math.min(MAX_Z, Math.ceil(Math.log2((ppd * SUPERSAMPLE) / 1.4222)));

    if (z < MIN_Z) {
      if (tiles.current.size) tiles.current.forEach((t, k) => { t.mesh.geometry.dispose(); t.mesh.material.map?.dispose(); t.mesh.material.dispose(); g.remove(t.mesh); tiles.current.delete(k); });
      if (status.current.z !== 0) { status.current = { z: 0, loading: 0 }; onStatus?.(status.current); }
      return;
    }

    const n = camera.position.clone().normalize();
    const lat = deg(Math.asin(n.y));
    const lon = deg(Math.atan2(-n.z, n.x));
    const horizon = deg(Math.acos(R / d));
    const screenRadius = deg(Math.hypot(size.width, size.height) / 2 / ppd) * 1.1;
    const radius = Math.max(0.2, Math.min(horizon, screenRadius));

    const need = wanted(z, lat, lon, radius, camera);
    const needKeys = new Set(need.map((t) => key(t.z, t.x, t.y)));
    wantedKeys.current = needKeys;
    need.forEach((t) => {
      const tile = tiles.current.get(key(t.z, t.x, t.y)) || spawn(t.z, t.x, t.y);
      tile.d = t.d;
    });
    pump();

    // Tiles of other zooms stay until everything the screen needs has loaded, then go
    const pending = need.filter((t) => ['queued', 'loading'].includes(tiles.current.get(key(t.z, t.x, t.y))?.state)).length;
    // Tiles nobody waits for any more that never started loading can go at once
    tiles.current.forEach((t, k) => {
      if (needKeys.has(k) || t.state !== 'queued') return;
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      g.remove(t.mesh);
      tiles.current.delete(k);
    });
    if (pending === 0) {
      tiles.current.forEach((t, k) => {
        if (needKeys.has(k)) return;
        t.mesh.geometry.dispose();
        t.mesh.material.map?.dispose();
        t.mesh.material.dispose();
        g.remove(t.mesh);
        tiles.current.delete(k);
      });
    }
    if (status.current.z !== z || status.current.loading !== pending) {
      status.current = { z, loading: pending };
      onStatus?.(status.current);
    }
  });

  return null;
}
