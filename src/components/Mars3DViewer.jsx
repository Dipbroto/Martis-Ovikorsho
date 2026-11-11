import { useRef, useMemo, useEffect, useState, useCallback, Suspense, memo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { Pause, Play, MapPin, Route, Droplets, Tent, Grid3x3, X, Map as MapIcon, Satellite, Sun, Wind, Layers, ChevronDown, Sparkles, Eye } from 'lucide-react';
import useMapStore, { routeSignature } from '../store/useMapStore';
import { landingSites } from '../data/landingSites';
import { loadGrid } from '../terrain/dem';
import { marsDistance } from '../utils/marsUtils';
import { playUiClick } from '../utils/audioSynthesizer';
import { subsolarPoint, lsFromDate } from '../utils/marsSolar';
import { ORBITERS, orbitShape, orbitPosition, MARS_RADIUS_KM, MARS_SIDEREAL_DAY_S } from '../data/orbiters';
import { DUST_STORM_REGIONS, DUST_SEASON_LS } from '../data/dustStormRegions';
import DetailTiles from './globe/DetailTiles';
import DeepSpaceCosmos from './globe/DeepSpaceCosmos';

// A realistic Mars globe built only from real data:
// - colour: the Viking MDIM 2.1 mosaic (USGS / NASA Trek), stitched by scripts/data/build_globe_texture.py
// - relief: a normal map computed in the browser from the MOLA elevation grid the app already loads
// - optional layers: landing sites, your planned route, Odyssey water map, USGS cave candidates, grid,
//   the real Sun position now, orbiters on their real orbits, and where regional dust storms start
// Labels stay out of the way: icons only, with names on hover or when the camera is close.

const R = 2;
const TEXTURE = '/textures/mars-viking-mdim21-4k.jpg';

/** Unit vector for a lat/lon on three.js's SphereGeometry UV layout (lon -180 at -x, lon 90E at -z). */
const dirFor = (lat, lon) => {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
};

const ROVER_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="9" width="12.5" height="4" rx="1"/><path d="M14.5 9V5.2"/><rect x="13.2" y="3" width="4.6" height="2.4" rx="0.6"/><path d="M6.5 13l-1.8 3.2M10.8 13v3.2M15 13l1.8 3.2"/><circle cx="4.6" cy="18.2" r="1.7"/><circle cx="10.8" cy="18.2" r="1.7"/><circle cx="17" cy="18.2" r="1.7"/></svg>';
const LANDER_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12.5h10l-1.8-4H8.8z"/><path d="M8.5 12.5l-3.2 5.8M15.5 12.5l3.2 5.8M12 12.5v5.8"/><path d="M9.3 5.4a3.2 3.2 0 0 1 5.4 0"/><path d="M12 8.5V5.8"/></svg>';

const LAYERS_PREF = 'marswalk-globe-layers'; // 'open' or 'folded': the layers panel stays as you left it
const HOME_DIST = 7.6; // the default view: the whole planet with room around it
const INTRO_DIST = 10.5; // the camera starts here and glides in to HOME_DIST once the planet is ready

const FLY_TO = [
  { id: 'global', name: 'Whole planet', lat: 5, lon: -70, dist: 7.6, mapZoom: 2 },
  { id: 'jezero', name: 'Jezero Crater', lat: 18.38, lon: 77.58, dist: 2.18, mapZoom: 8 },
  { id: 'gale', name: 'Gale Crater', lat: -4.8, lon: 137.6, dist: 2.21, mapZoom: 8 },
  { id: 'olympus', name: 'Olympus Mons', lat: 18.65, lon: -133.8, dist: 2.32, mapZoom: 6 },
  { id: 'valles', name: 'Valles Marineris', lat: -9.8, lon: -76.5, dist: 2.45, mapZoom: 6 },
  { id: 'north', name: 'North polar cap', lat: 84.0, lon: 0.0, dist: 2.36, mapZoom: 6 },
];

// ---------- data hooks ----------

/** Tangent-space normal map from the MOLA global grid: real topography lighting on the globe. */
function useMolaNormalMap(enabled) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    loadGrid('global').then(async (g) => {
      if (cancelled) return;
      const { width: W, height: H, data, nodata } = g;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      const img = ctx.createImageData(W, H);
      const cell = (Math.PI * 3389500) / H; // metres per pixel north-south
      const k = 18; // vertical exaggeration so planet-scale relief reads at globe size
      const at = (c, r) => {
        const v = data[Math.min(H - 1, Math.max(0, r)) * W + ((c + W) % W)];
        return v === nodata ? 0 : v;
      };
      // Worked out a band of rows at a time, so the planet keeps turning smoothly while it is built
      for (let r0 = 0; r0 < H; r0 += 48) {
        for (let r = r0; r < Math.min(H, r0 + 48); r++) {
          const coslat = Math.max(0.05, Math.cos(((90 - (r + 0.5) * (180 / H)) * Math.PI) / 180));
          for (let c = 0; c < W; c++) {
            const dzdx = ((at(c + 1, r) - at(c - 1, r)) / (2 * cell * coslat)) * k;
            const dzdn = ((at(c, r - 1) - at(c, r + 1)) / (2 * cell)) * k;
            const len = Math.hypot(dzdx, dzdn, 1);
            const i = (r * W + c) * 4;
            img.data[i] = ((-dzdx / len) * 0.5 + 0.5) * 255;
            img.data[i + 1] = ((-dzdn / len) * 0.5 + 0.5) * 255;
            img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
            img.data[i + 3] = 255;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;
      }
      ctx.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = 4;
      setTex(t);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);
  return tex;
}

const JSON_3D_CACHE = new Map();

const useJson = (url, enabled) => {
  const [data, setData] = useState(() => (url && JSON_3D_CACHE.has(url) ? JSON_3D_CACHE.get(url) : null));

  useEffect(() => {
    if (!enabled || !url) return;
    if (JSON_3D_CACHE.has(url)) {
      setData(JSON_3D_CACHE.get(url));
      return;
    }
    let active = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) JSON_3D_CACHE.set(url, json);
        if (active) setData(json);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [url, enabled]);

  return url && JSON_3D_CACHE.has(url) ? JSON_3D_CACHE.get(url) : data;
};

// ---------- scene pieces ----------

function Globe({ onReady }) {
  const color = useTexture(TEXTURE);
  const normal = useMolaNormalMap(true);
  useEffect(() => { onReady?.(); }, [onReady]);
  const { gl } = useThree();
  useEffect(() => {
    color.colorSpace = THREE.SRGBColorSpace;
    color.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    color.needsUpdate = true;
  }, [color, gl]);
  return (
    <mesh>
      <sphereGeometry args={[R, 160, 120]} />
      <meshStandardMaterial
        map={color}
        normalMap={normal || undefined}
        normalScale={new THREE.Vector2(1.2, 1.2)}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

/** Thin dusty haze on the limb (Fresnel glow), the way Mars looks from orbit. */
function Atmosphere() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vN; void main(){ float i = pow(max(0.0, 0.72 - dot(vN, vec3(0.0, 0.0, 1.0))), 5.0); gl_FragColor = vec4(0.95, 0.66, 0.5, 1.0) * i * 1.1; }',
  }), []);
  return (
    <mesh scale={1.045}>
      <sphereGeometry args={[R, 96, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Keeps the key light just above-left of the camera so the side you look at is always lit. */
function CameraLight({ dirOut }) {
  const light = useRef();
  const { camera } = useThree();
  const offset = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!light.current) return;
    offset.set(-2.2, 2.4, 0).applyQuaternion(camera.quaternion);
    light.current.position.copy(camera.position).add(offset);
    dirOut.copy(light.current.position).normalize();
  });
  return <directionalLight ref={light} intensity={2.4} color="#fff3e8" />;
}

/** Real sunlight: the Sun straight above the subsolar point right now, so day and night are true. */
function SunLight({ sub, dirOut }) {
  const pos = useMemo(() => dirFor(sub.lat, sub.lon).multiplyScalar(12), [sub]);
  const mark = useMemo(() => dirFor(sub.lat, sub.lon).multiplyScalar(R * 1.01), [sub]);
  const tag = useRef();
  const { camera } = useThree();
  useEffect(() => { dirOut.copy(pos).normalize(); }, [pos, dirOut]);
  useFrame(() => { if (tag.current) tag.current.style.opacity = facing(mark, camera) ? '1' : '0'; });
  return (
    <>
      <directionalLight position={pos} intensity={2.9} color="#fff4e6" />
      <Html position={mark} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={tag} className="flex items-center gap-1 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-amber-200 transition-opacity">
          <Sun className="w-3 h-3" />Sun overhead
        </div>
      </Html>
    </>
  );
}

const _p = new THREE.Vector3();
const _toCam = new THREE.Vector3();
/** true when a surface point faces the camera (not behind the planet) */
const facing = (pos, camera) => {
  _toCam.copy(camera.position).sub(pos).normalize();
  return _p.copy(pos).normalize().dot(_toCam) > 0.12;
};

/** true when the planet is between the camera and a point in space */
const _d = new THREE.Vector3();
const hiddenByPlanet = (pos, camera) => {
  _d.copy(pos).sub(camera.position);
  const len = _d.length();
  _d.divideScalar(len);
  const t = -camera.position.dot(_d);
  if (t <= 0 || t >= len) return false;
  return _p.copy(camera.position).addScaledVector(_d, t).length() < R;
};

function SiteMarker({ site, onSelect, selected }) {
  const pos = useMemo(() => dirFor(site.lat, site.lon).multiplyScalar(R * 1.004), [site]);
  const label = useRef();
  const [hover, setHover] = useState(false);
  const { camera } = useThree();
  const rover = /rover|sojourner/i.test(site.name);
  useFrame(() => {
    if (!label.current) return;
    const show = facing(pos, camera) && (hover || selected || camera.position.length() < 3.6);
    label.current.style.opacity = show ? '1' : '0';
  });
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshBasicMaterial color={site.color || '#38bdf8'} />
      </mesh>
      {/* larger invisible target so the small dot is easy to hover and click */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
        onClick={(e) => { e.stopPropagation(); onSelect(site); }}
      >
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none', transition: 'opacity 0.2s' }}>
        <div ref={label} style={{ opacity: 0 }} className="translate-y-5 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-black/75 px-2 py-0.5 text-[11px] font-medium text-white shadow-lg backdrop-blur">
          <span dangerouslySetInnerHTML={{ __html: rover ? ROVER_SVG : LANDER_SVG }} />
          {site.name}
        </div>
      </Html>
    </group>
  );
}

function RouteOnGlobe({ points, label, crew }) {
  const line = useMemo(() => points.map(([lat, lon]) => dirFor(lat, lon).multiplyScalar(R * 1.003)), [points]);
  const mid = line[Math.floor(line.length / 2)];
  const crewAt = useMemo(() => (crew ? dirFor(crew[0], crew[1]).multiplyScalar(R * 1.012) : null), [crew]);
  const ring = useRef();
  const tag = useRef();
  const { camera } = useThree();
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), mid.clone().normalize()), [mid]);
  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() % 1.8) / 1.8;
    if (ring.current) {
      ring.current.scale.setScalar(0.6 + t * 1.6);
      ring.current.material.opacity = 0.9 * (1 - t);
    }
    if (tag.current) tag.current.style.opacity = facing(mid, camera) ? '1' : '0';
  });
  return (
    <group>
      {line.length > 1 && <Line points={line} color="#ff7b4d" lineWidth={3} />}
      {crewAt && (
        <mesh position={crewAt}>
          <sphereGeometry args={[0.03, 16, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
      <mesh position={mid} quaternion={quat}>
        <ringGeometry args={[0.03, 0.04, 40]} />
        <meshBasicMaterial color="#ff7b4d" transparent />
      </mesh>
      <mesh ref={ring} position={mid} quaternion={quat}>
        <ringGeometry args={[0.03, 0.036, 40]} />
        <meshBasicMaterial color="#ffb08f" transparent />
      </mesh>
      <Html position={mid} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={tag} className="-translate-y-7 whitespace-nowrap rounded-full bg-[#F26A3D] px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-lg transition-opacity">{label}</div>
      </Html>
    </group>
  );
}

function ElementShell({ data, ramp }) {
  const tex = useMemo(() => {
    if (!data || !data.values || !data.cols || !data.rows) return null;
    const canvas = document.createElement('canvas');
    canvas.width = data.cols;
    canvas.height = data.rows;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(data.cols, data.rows);
    const span = data.max - data.min || 1;
    data.values.forEach((row, r) => row.forEach((v, c) => {
      if (v === null) return;
      const t = Math.max(0, Math.min(1, (v - data.min) / span));
      const rgb = ramp ? ramp(t) : [56, 189, 248];
      img.data.set([rgb[0], rgb[1], rgb[2], Math.round(40 + 170 * t)], (r * data.cols + c) * 4);
    }));
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [data, ramp]);
  if (!tex) return null;
  return (
    <mesh>
      <sphereGeometry args={[R * 1.002, 96, 64]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

const ELEMENT_3D_RAMPS = {
  ice: (t) => [Math.round(40 + 180 * t), Math.round(140 + 100 * t), 248],
  iron: (t) => [Math.round(180 + 75 * t), Math.round(30 + 50 * t), 20],
  silicon: (t) => [Math.round(200 + 55 * t), Math.round(140 + 90 * t), 20],
  potassium: (t) => [Math.round(140 + 70 * t), 40, Math.round(200 + 55 * t)],
  thorium: (t) => [20, Math.round(180 + 75 * t), Math.round(120 + 80 * t)],
  chlorine: (t) => [Math.round(120 + 80 * t), Math.round(190 + 65 * t), 30],
};

const ELEMENT_3D_FILES = {
  ice: '/data/h2o.json',
  iron: '/data/fe.json',
  silicon: '/data/si.json',
  potassium: '/data/k.json',
  thorium: '/data/th.json',
  chlorine: '/data/cl.json',
};

function CavePoints({ caves }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(caves.length * 3);
    caves.forEach((c, i) => {
      const v = dirFor(c.lat, c.lon).multiplyScalar(R * 1.004);
      arr.set([v.x, v.y, v.z], i * 3);
    });
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, [caves]);
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#fbbf24" size={0.022} sizeAttenuation />
    </points>
  );
}

function Graticule() {
  const lines = useMemo(() => {
    const out = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      for (let lon = -180; lon <= 180; lon += 4) pts.push(dirFor(lat, lon).multiplyScalar(R * 1.0015));
      out.push(pts);
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const pts = [];
      for (let lat = -88; lat <= 88; lat += 4) pts.push(dirFor(lat, lon).multiplyScalar(R * 1.0015));
      out.push(pts);
    }
    return out;
  }, []);
  return lines.map((pts, i) => <Line key={i} points={pts} color="#ffffff" lineWidth={0.6} transparent opacity={0.18} />);
}

const KM = R / MARS_RADIUS_KM;
const ORBIT_SPEEDUP = 60;

/**
 * Orbiters on their real orbits, sped up 60x. The orbits stay fixed in space while Mars turns under
 * them, so in this planet-fixed view they drift west once a sol, as ground tracks do.
 */
function Orbiters() {
  const group = useRef();
  const craft = useRef([]);
  const labels = useRef([]);
  const { camera } = useThree();
  const paths = useMemo(() => ORBITERS.map((o) => {
    const { periodS } = orbitShape(o);
    return Array.from({ length: 241 }, (_, k) => {
      const p = orbitPosition(o, (k / 240) * periodS);
      return new THREE.Vector3(p.x * KM, p.z * KM, -p.y * KM);
    });
  }), []);
  const phase = useMemo(() => ORBITERS.map((o, i) => orbitShape(o).periodS * ((i * 0.37) % 1)), []);
  const world = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * ORBIT_SPEEDUP;
    if (group.current) group.current.rotation.y = -(2 * Math.PI * t) / MARS_SIDEREAL_DAY_S;
    ORBITERS.forEach((o, i) => {
      const m = craft.current[i];
      if (!m) return;
      const p = orbitPosition(o, t + phase[i]);
      m.position.set(p.x * KM, p.z * KM, -p.y * KM);
      m.getWorldPosition(world);
      if (labels.current[i]) labels.current[i].style.opacity = hiddenByPlanet(world, camera) ? '0' : '1';
    });
  });
  return (
    <group ref={group}>
      {ORBITERS.map((o, i) => (
        <group key={o.id}>
          <Line points={paths[i]} color={o.color} lineWidth={1} transparent opacity={0.32} />
          <mesh ref={(el) => { craft.current[i] = el; }}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshBasicMaterial color={o.color} />
            <mesh>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshBasicMaterial color={o.color} transparent opacity={0.18} depthWrite={false} />
            </mesh>
            <Html center zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>
              <div ref={(el) => { labels.current[i] = el; }} style={{ transform: 'translateX(calc(50% + 10px))' }} className="whitespace-nowrap rounded bg-black/60 px-1.5 py-px text-[10px] font-medium text-white/90 transition-opacity">
                {o.name}
              </div>
            </Html>
          </mesh>
        </group>
      ))}
    </group>
  );
}

const STORM_FRAG = `
uniform vec3 uCenters[${DUST_STORM_REGIONS.length}];
uniform float uRadii[${DUST_STORM_REGIONS.length}];
uniform float uTime;
uniform vec3 uLight;
varying vec3 vPos;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return v; }
void main() {
  vec3 n = normalize(vPos);
  float d = 0.0;
  for (int i = 0; i < ${DUST_STORM_REGIONS.length}; i++) {
    float ang = acos(clamp(dot(n, uCenters[i]), -1.0, 1.0));
    d = max(d, 1.0 - smoothstep(uRadii[i] * 0.3, uRadii[i], ang));
  }
  if (d < 0.002) discard;
  // Billowing dust: noise bent by noise, drifting slowly
  vec3 q = n * 7.0;
  vec3 w = vec3(fbm(q + vec3(uTime * 0.05, 0.0, 0.0)), fbm(q + vec3(5.2, uTime * 0.04, 1.3)), fbm(q + vec3(2.1, 7.7, -uTime * 0.045)));
  float f = fbm(q * 1.5 + w * 2.6);
  // a thin haze over the whole region, thicker billows inside it
  float dens = d * (0.35 + 0.65 * smoothstep(0.28, 0.62, f));
  float lit = 0.18 + 0.8 * max(dot(n, uLight), 0.0);
  vec3 dust = mix(vec3(0.55, 0.36, 0.22), vec3(0.8, 0.6, 0.42), smoothstep(0.4, 0.8, f));
  gl_FragColor = vec4(dust * lit, min(0.85, dens * 1.1));
}`;

/** Dust clouds over the regions where regional storms usually start, lit like the surface. */
function DustStorms({ lightDir }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCenters: { value: DUST_STORM_REGIONS.map((r) => dirFor(r.lat, r.lon)) },
      uRadii: { value: DUST_STORM_REGIONS.map((r) => THREE.MathUtils.degToRad(r.radiusDeg)) },
      uTime: { value: 0 },
      uLight: { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: STORM_FRAG,
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
    material.uniforms.uLight.value.copy(lightDir);
  });
  return (
    <mesh>
      <sphereGeometry args={[R * 1.008, 128, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Flies the camera to a requested spot in a smooth orbital arc above Mars; any drag takes over immediately. */
function CameraRig({ target, controls, onArrive }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    if (!target) return;

    const curLen = camera.position.length();
    const tgtLen = target.length();
    const curDir = camera.position.clone().normalize();
    const tgtDir = target.clone().normalize();

    // Smooth orbital arc interpolation
    const factor = 1 - Math.exp(-dt * 3.4);
    curDir.lerp(tgtDir, factor).normalize();

    // Preserve orbital clearance so camera never cuts through the planet
    const newLen = THREE.MathUtils.lerp(curLen, tgtLen, factor);
    const angle = camera.position.angleTo(target);
    const arcBoost = Math.sin(Math.min(Math.PI, angle)) * 0.45;
    const finalLen = Math.max(newLen, 2.06) + (angle > 0.25 ? arcBoost : 0);

    camera.position.copy(curDir.multiplyScalar(finalLen));
    controls.current?.update();

    if (camera.position.distanceTo(target) < 0.015) {
      camera.position.copy(target);
      controls.current?.update();
      onArrive();
    }
  });
  return null;
}

// ---------- UI ----------

const LAYER_CHIPS = [
  { key: 'cosmos', label: 'Solar system & stars', icon: Sparkles },
  { key: 'sites', label: 'Landing sites', icon: MapPin },
  { key: 'route', label: 'My route', icon: Route },
  { key: 'water', label: 'Water ice', icon: Droplets },
  { key: 'caves', label: 'Caves', icon: Tent },
  { key: 'sun', label: 'Sunlight now', icon: Sun },
  { key: 'orbiters', label: 'Orbiters', icon: Satellite },
  { key: 'storms', label: 'Dust storms', icon: Wind },
  { key: 'grid', label: 'Grid', icon: Grid3x3 },
];

const MiniSwitch = ({ on }) => (
  <span className={`relative inline-block w-7 h-4 rounded-full shrink-0 transition-colors ${on ? 'bg-[#F26A3D]' : 'bg-white/20'}`}>
    <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-3' : ''}`} />
  </span>
);

const hm = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
};

function Mars3DViewer() {
  const { waypoints, routeGeometry, selectedPOI, setSelectedPOI, setViewMode, flyToCoordinate, viewMode, mapCenter, mapZoom, globeFocus } = useMapStore(useShallow((s) => ({
    viewMode: s.viewMode, waypoints: s.waypoints, routeGeometry: s.routeGeometry, selectedPOI: s.selectedPOI, setSelectedPOI: s.setSelectedPOI,
    setViewMode: s.setViewMode, flyToCoordinate: s.flyToCoordinate, mapCenter: s.mapCenter, mapZoom: s.mapZoom, globeFocus: s.globeFocus,
  })));
  // Where the crew had got to on the walk, if one was started
  const crewPos = useMapStore((s) => s.roverCurrentPosition);
  const crewProgress = useMapStore((s) => s.roverProgress);
  const crew = useMemo(() => (crewPos && crewProgress > 0.003 ? [crewPos.lat, crewPos.lon] : null), [crewPos, crewProgress]);
  const covered = useMapStore((s) => s.isStreetViewOpen); // nothing here is visible behind the surface view
  const [hasWebGL] = useState(() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  });
  const [layers, setLayers] = useState({ sites: true, route: true, water: false, caves: false, sun: false, cosmos: true, orbiters: false, storms: false, grid: false });
  const [selectedCelestial, setSelectedCelestial] = useState(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [detail, setDetail] = useState({ z: 0, loading: 0 });
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => {
    try { const v = localStorage.getItem(LAYERS_PREF); if (v) return v === 'open'; } catch { /* storage blocked */ }
    return true;
  });
  const rootRef = useRef(null);
  // The width of this pane (the globe is half the screen in split view), so the bars fit it
  const [paneW, setPaneW] = useState(1200);
  useEffect(() => {
    if (!rootRef.current || !window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(([e]) => setPaneW(e.contentRect.width));
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);
  const [target, setTarget] = useState(null);
  const [active, setActive] = useState('global');
  const controls = useRef();
  // A narrow pane (phone, or the split view) starts with the layers folded away
  useEffect(() => {
    let chosen = false;
    try { chosen = !!localStorage.getItem(LAYERS_PREF); } catch { /* storage blocked */ }
    if (!chosen && rootRef.current && rootRef.current.clientWidth < 640) setPanelOpen(false);
  }, []);
  const togglePanel = () => setPanelOpen((v) => {
    try { localStorage.setItem(LAYERS_PREF, v ? 'folded' : 'open'); } catch { /* storage blocked */ }
    return !v;
  });
  const lightDir = useMemo(() => new THREE.Vector3(1, 0, 0), []);

  // The real Sun position, refreshed every minute while that layer is on
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!layers.sun && !layers.storms && !layers.cosmos) return undefined;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, [layers.sun, layers.storms, layers.cosmos]);
  const sub = useMemo(() => subsolarPoint(now), [now]);
  const ls = useMemo(() => lsFromDate(now), [now]);
  const dustSeason = ls >= DUST_SEASON_LS[0] && ls < DUST_SEASON_LS[1];

  const terrainOverlay = useMapStore((s) => s.terrainOverlay);
  const activeElemKey = ELEMENT_3D_FILES[terrainOverlay] ? terrainOverlay : (layers.water ? 'ice' : null);
  const activeElemFile = activeElemKey ? ELEMENT_3D_FILES[activeElemKey] : null;
  const activeElemRamp = activeElemKey ? ELEMENT_3D_RAMPS[activeElemKey] : null;
  const elemResourceData = useJson(activeElemFile, !!activeElemFile);
  const caves = useJson('/data/caves.json', layers.caves || terrainOverlay === 'caves');

  // The route as drawn on the globe: the planner's full path when there is one
  const route = useMemo(() => {
    if (waypoints.length < 2) return null;
    const planned = routeGeometry && routeGeometry.signature === routeSignature(waypoints);
    const points = planned ? routeGeometry.points : waypoints.map((w) => [w.lat, w.lon]);
    let km = 0;
    for (let i = 1; i < points.length; i++) km += marsDistance(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    return { points, km, center: points[Math.floor(points.length / 2)] };
  }, [waypoints, routeGeometry]);

  const prevCenterRef = useRef(null);
  const flyTo = (lat, lon, dist, id, mapZoom = 7) => {
    playUiClick();
    setAutoRotate(false);
    setActive(id);
    setTarget(dirFor(lat, lon).multiplyScalar(dist));
    // This flight already has its own distance, so the map-center effect below must not replace it
    prevCenterRef.current = [lat, lon];
    flyToCoordinate(lat, lon, mapZoom);
  };

  // Re-orient the 3D globe camera whenever the map center changes (e.g. from Eva navigation)
  useEffect(() => {
    if (!mapCenter) return;
    const [lat, lon] = mapCenter;
    if (prevCenterRef.current && prevCenterRef.current[0] === lat && prevCenterRef.current[1] === lon) return;
    prevCenterRef.current = [lat, lon];
    if (lat === 0 && lon === 0) return; // default global view
    setAutoRotate(false);
    const match = FLY_TO.find(p => p.id !== 'global' && Math.abs(p.lat - lat) < 0.5 && Math.abs(p.lon - lon) < 0.5);
    const dist = match ? match.dist : Math.max(2.18, 2.5 - ((mapZoom || 4) - 3) * 0.1);
    setTarget(dirFor(lat, lon).multiplyScalar(dist));
  }, [mapCenter, mapZoom]);

  // In split view, turn the globe to whatever was just picked on the 2D map
  const prevFocusRef = useRef(globeFocus);
  useEffect(() => {
    if (!globeFocus || globeFocus === prevFocusRef.current) return;
    prevFocusRef.current = globeFocus;
    if (viewMode !== 'split') return;
    const dist = globeFocus.dist ?? controls.current?.object.position.length() ?? HOME_DIST;
    setAutoRotate(false);
    setActive(null);
    setTarget(dirFor(globeFocus.lat, globeFocus.lon).multiplyScalar(dist));
  }, [globeFocus, viewMode]);

  // Start on the whole planet, turned towards the planned route if there is one
  const home = useMemo(() => {
    const [lat, lon] = route ? route.center : [5, -70];
    return dirFor(lat, lon);
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLayer = (key) => {
    const on = !layers[key];
    setLayers((l) => ({ ...l, [key]: on }));
    if (!on) return;
    // Bring each new layer into view
    if (key === 'sun') {
      const s = subsolarPoint(new Date());
      flyTo(s.lat * 0.5, s.lon + 70, 7.2, 'sun', 2);
    } else if (key === 'cosmos') {
      const cam = controls.current?.object;
      if (cam && cam.position.length() < 9) {
        setAutoRotate(false);
        setActive(null);
        setTarget(cam.position.clone().setLength(12));
      }
    } else if (key === 'orbiters') {
      const cam = controls.current?.object;
      if (cam && cam.position.length() < 12) {
        setAutoRotate(false);
        setActive(null);
        setTarget(cam.position.clone().setLength(14));
      }
    } else if (key === 'storms') {
      flyTo(-15, 40, 7.2, 'storms', 2);
    }
  };

  // The planet is ready: fade in and glide to the home view
  const onGlobeReady = useCallback(() => {
    setReady(true);
    setTarget(home.clone().multiplyScalar(HOME_DIST));
  }, [home]);

  const selectSite = (site) => {
    setSelectedCelestial(null);
    setSelectedPOI({ ...site, poiType: 'landingSite' });
    flyTo(site.lat, site.lon, 2.18, site.id, 8);
  };

  if (!hasWebGL) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#05070b] text-zinc-300">
        <div className="text-center p-6 ui-panel rounded-2xl max-w-md">
          <h3 className="text-white font-semibold text-lg mb-2">3D needs WebGL</h3>
          <p className="text-sm text-zinc-400">This browser can't draw the 3D globe. The 2D map has all the same data.</p>
        </div>
      </div>
    );
  }

  const selectedSite = selectedPOI?.poiType === 'landingSite' ? selectedPOI : null;

  return (
    <div ref={rootRef} className="w-full h-full bg-[#020306] relative overflow-hidden select-none">
      {/* Held over the canvas until the planet is drawn, so nothing half-built is ever seen */}
      <div className={`absolute inset-0 z-[5] bg-[#020306] flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${ready ? 'opacity-0' : 'opacity-100'}`} aria-hidden={ready}>
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[#F26A3D] animate-spin" />
          <span className="text-xs text-zinc-400">Loading Mars…</span>
        </div>
      </div>
      <Canvas camera={{ position: home.clone().multiplyScalar(INTRO_DIST).toArray(), fov: 40, near: 0.05, far: 400 }} dpr={[1, 1.75]} frameloop={covered ? 'never' : 'always'} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#020306']} />
        <ambientLight intensity={layers.sun ? 0.04 : 0.35} />
        {layers.sun ? <SunLight sub={sub} dirOut={lightDir} /> : <CameraLight dirOut={lightDir} />}
        <Stars radius={160} depth={50} count={2600} factor={2.6} saturation={0} fade speed={0.2} />
        {/* The planet, its haze and its detail tiles only exist once the colour texture is here, so the
            glow can never be drawn on its own as a bright disc */}
        <Suspense fallback={null}>
          <Globe onReady={onGlobeReady} />
          <DetailTiles onStatus={setDetail} />
          <Atmosphere />
        </Suspense>
        {layers.cosmos && (
          <Suspense fallback={null}>
            <DeepSpaceCosmos
              now={now}
              subsolar={sub}
              onSelectBody={(body) => {
                setSelectedPOI(null);
                setSelectedCelestial(body);
              }}
            />
          </Suspense>
        )}
        {layers.storms && <DustStorms lightDir={lightDir} />}
        {layers.orbiters && <Orbiters />}
        {layers.grid && <Graticule />}
        {elemResourceData && activeElemRamp && <ElementShell data={elemResourceData} ramp={activeElemRamp} />}
        {(layers.caves || terrainOverlay === 'caves') && caves && <CavePoints caves={caves.caves} />}
        {layers.sites && landingSites.map((site) => (
          <SiteMarker key={site.id} site={site} onSelect={selectSite} selected={selectedSite?.id === site.id} />
        ))}
        {layers.route && route && <RouteOnGlobe points={route.points} label={`Your route · ${route.km.toFixed(1)} km`} crew={crew} />}
        <CameraRig target={target} controls={controls} onArrive={() => setTarget(null)} />
        <OrbitControls
          ref={controls}
          enablePan={false}
          minDistance={2.06}
          maxDistance={38}
          rotateSpeed={0.45}
          zoomSpeed={0.7}
          enableDamping
          dampingFactor={0.08}
          autoRotate={autoRotate && !target}
          autoRotateSpeed={0.35}
          onStart={() => { setTarget(null); setAutoRotate(false); }}
        />
      </Canvas>

      {/* Layers, top right. One column that scrolls inside itself, so it never runs under the fly-to bar
          at the bottom, and a header that folds it away (folded by default in a narrow pane). */}
      <div className="absolute top-[140px] right-4 z-10 w-[min(272px,calc(100%-2rem))] max-h-[calc(100%-300px)] min-h-[150px] overflow-y-auto overflow-x-hidden custom-scrollbar-y flex flex-col gap-2">
        <div className="ui-panel rounded-2xl shrink-0">
          <button
            onClick={togglePanel}
            aria-expanded={panelOpen}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left cursor-pointer"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-white"><Layers className="w-4 h-4 text-[#ff8a5f]" />Layers</span>
            <span className="flex items-center gap-2 text-xs text-zinc-400">
              {Object.values(layers).filter(Boolean).length} on
              <ChevronDown className={`w-4 h-4 transition-transform ${panelOpen ? '' : '-rotate-90'}`} />
            </span>
          </button>
          {panelOpen && (
            <div className="px-2 pb-2 flex flex-col gap-0.5" role="group" aria-label="Globe layers">
              {LAYER_CHIPS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => toggleLayer(key)}
                  aria-pressed={layers[key]}
                  disabled={key === 'route' && !route}
                  className={`h-9 px-2.5 rounded-lg flex items-center gap-2.5 text-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${layers[key] ? 'bg-white/[0.1] text-white' : 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${layers[key] ? 'text-[#ff8a5f]' : 'text-zinc-400'}`} />
                  <span className="flex-1 text-left">{label}</span>
                  <MiniSwitch on={layers[key] && !(key === 'route' && !route)} />
                </button>
              ))}
              <div className="mt-1 pt-1.5 border-t border-white/10">
                <button
                  onClick={() => setAutoRotate((v) => !v)}
                  aria-pressed={autoRotate}
                  className="w-full h-9 px-2.5 rounded-lg flex items-center gap-2.5 text-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  {autoRotate ? <Pause className="w-4 h-4 shrink-0 text-zinc-400" /> : <Play className="w-4 h-4 shrink-0 text-zinc-400" />}
                  <span className="flex-1 text-left">Spin the planet</span>
                  <MiniSwitch on={autoRotate} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* What the live layers show, and where the numbers come from */}
        {(layers.sun || layers.orbiters || layers.storms) && (
          <div className="ui-panel rounded-2xl p-3.5 w-full shrink-0 text-xs text-zinc-300 space-y-3">
            {layers.sun && (
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-white"><Sun className="w-3.5 h-3.5 text-amber-300" />Sunlight now</div>
                <p className="mt-1 leading-relaxed">
                  The Sun is straight overhead at <span className="text-white tabular-nums">{Math.abs(sub.lat).toFixed(1)}°{sub.lat >= 0 ? 'N' : 'S'}, {Math.abs(sub.lon).toFixed(1)}°{sub.lon >= 0 ? 'E' : 'W'}</span>. Season Ls {ls.toFixed(0)}°. The dark side is in night right now.
                </p>
              </div>
            )}
            {layers.orbiters && (
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-white"><Satellite className="w-3.5 h-3.5 text-sky-300" />Orbiters, {ORBIT_SPEEDUP}× faster</div>
                <ul className="mt-2 space-y-1.5">
                  {ORBITERS.map((o) => (
                    <li key={o.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0">
                        <span className="text-white"><i className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: o.color }} />{o.name}</span>
                        <span className="block pl-3 text-[11px] text-zinc-500">{o.periKm === o.apoKm ? `${o.periKm} km` : `${o.periKm.toLocaleString()} to ${o.apoKm.toLocaleString()} km`} up</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-300 whitespace-nowrap">{hm(orbitShape(o).periodS)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed">Altitudes, tilts and periods are the real orbits (Kepler’s laws); where each craft is along its orbit right now is not tracked.</p>
              </div>
            )}
            {layers.storms && (
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-white"><Wind className="w-3.5 h-3.5 text-orange-300" />Dust storms</div>
                <p className="mt-1 leading-relaxed">Where regional storms most often start, from orbiter storm records since 1999: the northern storm tracks and the big southern basins.</p>
                <p className={`mt-1.5 rounded-lg px-2 py-1 ${dustSeason ? 'bg-orange-500/15 text-orange-200' : 'bg-white/5 text-zinc-400'}`}>
                  Now Ls {ls.toFixed(0)}°: {dustSeason ? 'inside the main dust storm season (Ls 180–360°).' : 'outside the main dust storm season (Ls 180–360°).'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Selected Celestial Body Telemetry Card */}
        {selectedCelestial && (
          <div className="ui-panel rounded-2xl p-3.5 w-full shrink-0 text-sm text-zinc-200 border border-amber-500/30 bg-black/90 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" style={{ background: selectedCelestial.color || '#f59e0b' }} />
                <div>
                  <div className="font-semibold text-white tracking-wide">{selectedCelestial.name}</div>
                  <div className="text-[11px] text-zinc-400 capitalize">{selectedCelestial.type || 'Celestial Body'} · NASA Ephemeris</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCelestial(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-zinc-300 leading-relaxed">{selectedCelestial.description}</p>
            {selectedCelestial.subtext && (
              <p className="mt-1 text-[11px] text-amber-200/80 font-mono">{selectedCelestial.subtext}</p>
            )}

            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs font-mono bg-white/5 rounded-lg p-2 border border-white/5">
              {selectedCelestial.distAu !== undefined && (
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">Distance</span>
                  <span className="text-amber-200 font-semibold">{selectedCelestial.distAu.toFixed(3)} AU</span>
                  <span className="block text-[10px] text-zinc-400">({(selectedCelestial.distKm / 1e6).toFixed(1)}M km)</span>
                </div>
              )}
              {selectedCelestial.distLy !== undefined && (
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">Cosmic Distance</span>
                  <span className="text-sky-300 font-semibold">{selectedCelestial.distLy.toLocaleString()} ly</span>
                  <span className="block text-[10px] text-zinc-400">light-years</span>
                </div>
              )}
              {selectedCelestial.distKm !== undefined && selectedCelestial.distAu === undefined && (
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">Orbital Radius</span>
                  <span className="text-amber-200 font-semibold">{selectedCelestial.distKm.toLocaleString()} km</span>
                </div>
              )}
              {selectedCelestial.lightMinutes !== undefined && (
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">Light Delay</span>
                  <span className="text-sky-300 font-semibold">
                    {selectedCelestial.lightMinutes >= 1
                      ? `${selectedCelestial.lightMinutes.toFixed(1)} min`
                      : `${(selectedCelestial.lightMinutes * 60).toFixed(0)} sec`}
                  </span>
                  <span className="block text-[10px] text-zinc-400">one-way light time</span>
                </div>
              )}
              {selectedCelestial.mag !== undefined && (
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">Apparent Mag</span>
                  <span className="text-white font-semibold">{selectedCelestial.mag}</span>
                </div>
              )}
              {selectedCelestial.lat !== undefined && selectedCelestial.lon !== undefined && (
                <div className="col-span-2 pt-1 border-t border-white/5">
                  <span className="text-zinc-500 text-[10px] uppercase mr-2">Celestial Dir:</span>
                  <span className="text-zinc-300">
                    {Math.abs(selectedCelestial.lat).toFixed(1)}°{selectedCelestial.lat >= 0 ? 'N' : 'S'}, {Math.abs(selectedCelestial.lon).toFixed(1)}°{selectedCelestial.lon >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (selectedCelestial.lat !== undefined && selectedCelestial.lon !== undefined) {
                  flyTo(selectedCelestial.lat * 0.4, selectedCelestial.lon, 14, selectedCelestial.id);
                } else if (selectedCelestial.id === 'phobos') {
                  const cam = controls.current?.object;
                  if (cam) {
                    setAutoRotate(false);
                    setActive('phobos');
                    setTarget(cam.position.clone().setLength(9.5));
                  }
                } else if (selectedCelestial.id === 'deimos') {
                  const cam = controls.current?.object;
                  if (cam) {
                    setAutoRotate(false);
                    setActive('deimos');
                    setTarget(cam.position.clone().setLength(20));
                  }
                }
              }}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/30 font-semibold py-1.5 text-xs hover:bg-amber-500/30 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />Align View with {selectedCelestial.name.split(' ')[0]}
            </button>
          </div>
        )}

        {/* Selected landing site */}
        {selectedSite && (
          <div className="ui-panel rounded-2xl p-3.5 w-full shrink-0 text-sm text-zinc-200">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-white">{selectedSite.name}</div>
                <div className="text-xs text-zinc-400">{selectedSite.mission} · {selectedSite.agency} · {selectedSite.location}</div>
              </div>
              <button onClick={() => setSelectedPOI(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <p className="mt-2 text-xs text-zinc-300 leading-relaxed line-clamp-4">{selectedSite.description}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-zinc-500">Landed</span><div className="text-white">{selectedSite.landingDate}</div></div>
              <div><span className="text-zinc-500">Status</span><div className="text-white">{selectedSite.status}</div></div>
            </div>
            <button
              onClick={() => { if (viewMode === '3d') setViewMode('2d'); flyToCoordinate(selectedSite.lat, selectedSite.lon, 8); }}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-white text-black font-semibold py-2 text-xs hover:bg-zinc-200"
            >
              <MapIcon className="w-3.5 h-3.5" />Open in the 2D map
            </button>
          </div>
        )}
      </div>

      {/* Fly-to bar */}
      <div className={`absolute bottom-[76px] z-10 ${paneW >= 1100 ? 'left-auto right-[110px] w-[min(720px,calc(100%-560px))]' : 'left-4 right-4'}`}>
        <div className="ui-panel rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto custom-scrollbar-x">
          {route && (
            <button
              onClick={() => flyTo(route.center[0], route.center[1], 2.22, 'route', 8)}
              className={`shrink-0 h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${active === 'route' ? 'bg-[#F26A3D] text-white' : 'text-[#ffc2a8] hover:bg-white/10'}`}
            >
              My route
            </button>
          )}
          {FLY_TO.map((p) => (
            <button
              key={p.id}
              onClick={() => flyTo(p.lat, p.lon, p.dist, p.id, p.mapZoom)}
              className={`shrink-0 h-8 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${active === p.id ? 'bg-white text-black' : 'text-zinc-300 hover:text-white hover:bg-white/10'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-zinc-500">
          {detail.z >= 4
            ? `NASA THEMIS infrared (100 m) with Viking colour and MOLA relief${detail.loading ? ` · loading ${detail.loading} more tiles…` : ''}`
            : 'Viking MDIM 2.1 colour mosaic (NASA/USGS) with MOLA relief · drag to rotate, scroll to zoom in for detail'}
        </p>
      </div>
    </div>
  );
}

// Memoised: switching tabs re-renders App, and this page has no props that change, so it can skip that work
export default memo(Mars3DViewer);
