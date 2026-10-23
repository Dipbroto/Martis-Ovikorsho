import React, { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { getCelestialBodiesForGlobe, MOONS } from '../../utils/marsSky';

const R = 2; // Mars radius in Three.js space

/** Convert lat/lon on Mars sphere to 3D unit vector */
const dirFor = (lat, lon) => {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
};

/** Generate a realistic procedural Earth texture with oceans, continents and cloud swirls */
function createEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Deep oceanic blue gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0c2340');
  grad.addColorStop(0.5, '#00427c');
  grad.addColorStop(1, '#0c2340');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Continental landmasses
  ctx.fillStyle = '#2d6a4f';
  // Africa & Eurasia
  ctx.beginPath();
  ctx.ellipse(320, 110, 48, 55, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(360, 85, 75, 42, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Americas
  ctx.beginPath();
  ctx.ellipse(150, 90, 36, 52, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(185, 175, 30, 48, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Australia
  ctx.beginPath();
  ctx.ellipse(420, 180, 26, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Desert tints
  ctx.fillStyle = '#d4a373';
  ctx.beginPath();
  ctx.ellipse(310, 105, 30, 20, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Swirling white clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  for (let i = 0; i < 18; i++) {
    const x = (i * 32 + 20) % 512;
    const y = 50 + (i * 37) % 156;
    ctx.beginPath();
    ctx.ellipse(x, y, 32 + (i % 5) * 8, 8 + (i % 3) * 4, (i % 4) * 0.3 - 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Polar ice caps
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 14);
  ctx.fillRect(0, 242, 512, 14);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Generate a procedural Jupiter banded texture with the Great Red Spot */
function createJupiterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Alternating gas giant bands
  const bands = [
    '#9a6b43', '#e0cfb3', '#c98a58', '#f2e8cf', '#7f4f24',
    '#f5ebe0', '#8b5a2b', '#eddcd2', '#a3704c', '#e6ccb2'
  ];
  const h = 256 / bands.length;
  bands.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * h, 512, h + 1);
  });

  // Turbulence lines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  for (let y = 10; y < 256; y += 18) {
    ctx.fillRect(0, y, 512, 3);
  }

  // Great Red Spot
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.ellipse(320, 155, 24, 15, -0.1, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Generate Saturn's multi-ring texture with the Cassini Division */
function createSaturnRingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.12, 'rgba(212, 175, 120, 0.45)');
  grad.addColorStop(0.48, 'rgba(240, 218, 175, 0.85)');
  grad.addColorStop(0.53, 'rgba(10, 8, 6, 0.05)'); // Cassini Division!
  grad.addColorStop(0.57, 'rgba(225, 195, 145, 0.8)');
  grad.addColorStop(0.88, 'rgba(180, 150, 110, 0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Check if position is facing the camera */
const _toCam = new THREE.Vector3();
const _pos = new THREE.Vector3();
const facingCamera = (pos, camera) => {
  _toCam.copy(camera.position).sub(pos).normalize();
  return _pos.copy(pos).normalize().dot(_toCam) > 0.1;
};

/**
 * Deep Space Cosmos Component:
 * Places the real Sun, Earth & Moon, Venus, Jupiter, Saturn with 3D rings,
 * Mars's natural moons (Phobos & Deimos), and NASA J2000 bright stars in the sky.
 */
export default function DeepSpaceCosmos({ now, subsolar, onSelectBody }) {
  const { camera } = useThree();
  const earthTexture = useMemo(() => createEarthTexture(), []);
  const jupiterTexture = useMemo(() => createJupiterTexture(), []);
  const saturnRingTexture = useMemo(() => createSaturnRingTexture(), []);

  // Real NASA/JPL planetary & stellar positions
  const { planets, stars } = useMemo(() => {
    return getCelestialBodiesForGlobe(now, subsolar);
  }, [now, subsolar]);

  const [hoveredId, setHoveredId] = useState(null);

  // References for animation
  const earthGroup = useRef();
  const moonMesh = useRef();
  const phobosGroup = useRef();
  const deimosGroup = useRef();
  const jupiterMoonsGroup = useRef();
  const coronaMesh = useRef();

  // Animation ticks for moons and coronal pulse
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Earth's Moon orbital revolution
    if (moonMesh.current) {
      const moonAngle = t * 0.45;
      moonMesh.current.position.set(Math.cos(moonAngle) * 2.2, Math.sin(moonAngle) * 0.6, Math.sin(moonAngle) * 2.2);
    }

    // Mars's Moon: Phobos (Fast orbit: ~7.65 h)
    if (phobosGroup.current) {
      phobosGroup.current.rotation.y = t * 0.65;
    }

    // Mars's Moon: Deimos (Slower orbit: ~30.3 h)
    if (deimosGroup.current) {
      deimosGroup.current.rotation.y = t * 0.16;
    }

    // Jupiter's Galilean moons
    if (jupiterMoonsGroup.current) {
      jupiterMoonsGroup.current.rotation.y = t * 0.35;
    }

    // Gentle solar coronal pulsation
    if (coronaMesh.current) {
      const s = 1 + Math.sin(t * 1.5) * 0.04;
      coronaMesh.current.scale.set(s, s, s);
    }
  });

  return (
    <group name="deep-space-cosmos">
      {/* ============================================================== */}
      {/* 1. THE SUN (Real direction from Mars now, casting radiant glow) */}
      {/* ============================================================== */}
      {(() => {
        const sun = planets.find((p) => p.id === 'sun');
        if (!sun) return null;
        const sunPos = dirFor(sun.lat, sun.lon).multiplyScalar(125);
        const isHovered = hoveredId === 'sun';

        return (
          <group position={sunPos}>
            {/* Blazing core sphere */}
            <mesh
              onClick={(e) => { e.stopPropagation(); onSelectBody?.(sun); }}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId('sun'); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHoveredId(null); document.body.style.cursor = ''; }}
            >
              <sphereGeometry args={[3.2, 32, 32]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* Inner radiant corona */}
            <mesh ref={coronaMesh}>
              <sphereGeometry args={[4.2, 32, 32]} />
              <meshBasicMaterial color="#fef08a" transparent opacity={0.65} blending={THREE.AdditiveBlending} />
            </mesh>

            {/* Outer solar flare disc */}
            <mesh scale={2.4}>
              <sphereGeometry args={[3.6, 24, 24]} />
              <meshBasicMaterial color="#f97316" transparent opacity={0.25} blending={THREE.AdditiveBlending} />
            </mesh>

            {/* Tactical Label */}
            <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{ opacity: isHovered || camera.position.length() > 8 ? 1 : 0.8 }}
                className="translate-y-8 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-400/30 bg-black/80 px-2.5 py-0.5 text-[11px] font-mono text-amber-200 shadow-xl backdrop-blur transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="font-bold">SUN</span>
                <span className="text-zinc-400">·</span>
                <span className="text-zinc-300">{sun.distAu.toFixed(2)} AU</span>
                <span className="text-amber-400/90 font-semibold">({sun.lightMinutes.toFixed(1)}m light delay)</span>
              </div>
            </Html>
          </group>
        );
      })()}

      {/* ============================================================== */}
      {/* 2. EARTH & THE MOON (Home world with atmosphere & orbital Moon)*/}
      {/* ============================================================== */}
      {(() => {
        const earth = planets.find((p) => p.id === 'earth');
        if (!earth) return null;
        const earthPos = dirFor(earth.lat, earth.lon).multiplyScalar(95);
        const isHovered = hoveredId === 'earth';

        return (
          <group ref={earthGroup} position={earthPos}>
            {/* Earth Blue Marble Sphere */}
            <mesh
              onClick={(e) => { e.stopPropagation(); onSelectBody?.(earth); }}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId('earth'); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHoveredId(null); document.body.style.cursor = ''; }}
            >
              <sphereGeometry args={[1.05, 32, 32]} />
              <meshStandardMaterial map={earthTexture} roughness={0.7} metalness={0.1} />
            </mesh>

            {/* Cyan Atmospheric Glow Rim */}
            <mesh scale={1.08}>
              <sphereGeometry args={[1.05, 32, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} blending={THREE.AdditiveBlending} />
            </mesh>

            {/* The Moon (Luna) */}
            <mesh ref={moonMesh} position={[2.2, 0, 0]}>
              <sphereGeometry args={[0.26, 16, 16]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
            </mesh>

            {/* Moon Orbit Ring */}
            <Line
              points={Array.from({ length: 48 }, (_, i) => {
                const a = (i / 48) * Math.PI * 2;
                return [Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2];
              })}
              color="#38bdf8"
              lineWidth={1}
              transparent
              opacity={0.25}
            />

            {/* Tactical Label */}
            <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{ opacity: isHovered || camera.position.length() > 6 ? 1 : 0.85 }}
                className="translate-y-6 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-sky-400/40 bg-black/85 px-2.5 py-0.5 text-[11px] font-mono text-sky-200 shadow-xl backdrop-blur transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="font-bold text-white">EARTH & MOON</span>
                <span className="text-zinc-400">·</span>
                <span className="text-sky-300">{earth.distAu.toFixed(2)} AU</span>
                <span className="text-zinc-400 font-sans text-[10px]">({Math.round(earth.distKm / 1e6)}M km)</span>
              </div>
            </Html>
          </group>
        );
      })()}

      {/* ============================================================== */}
      {/* 3. JUPITER & GALILEAN MOONS (Giant banded sphere + 4 moons)     */}
      {/* ============================================================== */}
      {(() => {
        const jup = planets.find((p) => p.id === 'jupiter');
        if (!jup) return null;
        const jupPos = dirFor(jup.lat, jup.lon).multiplyScalar(108);
        const isHovered = hoveredId === 'jupiter';

        return (
          <group position={jupPos}>
            <mesh
              onClick={(e) => { e.stopPropagation(); onSelectBody?.(jup); }}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId('jupiter'); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHoveredId(null); document.body.style.cursor = ''; }}
            >
              <sphereGeometry args={[1.5, 32, 32]} />
              <meshStandardMaterial map={jupiterTexture} roughness={0.8} />
            </mesh>

            {/* Galilean Moons: Io, Europa, Ganymede, Callisto */}
            <group ref={jupiterMoonsGroup}>
              {/* Io */}
              <mesh position={[2.1, 0, 0]}>
                <sphereGeometry args={[0.07, 12, 12]} />
                <meshBasicMaterial color="#fef08a" />
              </mesh>
              {/* Europa */}
              <mesh position={[-2.7, 0.1, 0]}>
                <sphereGeometry args={[0.06, 12, 12]} />
                <meshBasicMaterial color="#f8fafc" />
              </mesh>
              {/* Ganymede */}
              <mesh position={[0, 0, 3.4]}>
                <sphereGeometry args={[0.09, 12, 12]} />
                <meshBasicMaterial color="#e2e8f0" />
              </mesh>
              {/* Callisto */}
              <mesh position={[0, -0.2, -4.2]}>
                <sphereGeometry args={[0.08, 12, 12]} />
                <meshBasicMaterial color="#94a3b8" />
              </mesh>
            </group>

            {/* Tactical Label */}
            <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{ opacity: isHovered ? 1 : 0.7 }}
                className="translate-y-6 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-500/30 bg-black/80 px-2 py-0.5 text-[11px] font-mono text-amber-200 shadow-lg backdrop-blur transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="font-bold">JUPITER</span>
                <span className="text-zinc-400">·</span>
                <span className="text-zinc-300">{jup.distAu.toFixed(2)} AU</span>
              </div>
            </Html>
          </group>
        );
      })()}

      {/* ============================================================== */}
      {/* 4. SATURN WITH 3D RINGS (Tilted Ring System)                    */}
      {/* ============================================================== */}
      {(() => {
        const sat = planets.find((p) => p.id === 'saturn');
        if (!sat) return null;
        const satPos = dirFor(sat.lat, sat.lon).multiplyScalar(115);
        const isHovered = hoveredId === 'saturn';

        return (
          <group position={satPos}>
            {/* Saturn Body */}
            <mesh
              onClick={(e) => { e.stopPropagation(); onSelectBody?.(sat); }}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId('saturn'); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHoveredId(null); document.body.style.cursor = ''; }}
            >
              <sphereGeometry args={[1.2, 32, 32]} />
              <meshStandardMaterial color="#fef08a" roughness={0.8} />
            </mesh>

            {/* Saturn 3D Tilted Ring Mesh */}
            <mesh rotation={[THREE.MathUtils.degToRad(27), 0, THREE.MathUtils.degToRad(15)]}>
              <ringGeometry args={[1.55, 2.85, 64]} />
              <meshStandardMaterial map={saturnRingTexture} side={THREE.DoubleSide} transparent opacity={0.92} />
            </mesh>

            {/* Tactical Label */}
            <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{ opacity: isHovered ? 1 : 0.7 }}
                className="translate-y-6 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-yellow-500/30 bg-black/80 px-2 py-0.5 text-[11px] font-mono text-yellow-200 shadow-lg backdrop-blur transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                <span className="font-bold">SATURN</span>
                <span className="text-zinc-400">·</span>
                <span className="text-zinc-300">{sat.distAu.toFixed(2)} AU</span>
              </div>
            </Html>
          </group>
        );
      })()}

      {/* ============================================================== */}
      {/* 5. VENUS (Brilliant morning/evening star beacon)                */}
      {/* ============================================================== */}
      {(() => {
        const ven = planets.find((p) => p.id === 'venus');
        if (!ven) return null;
        const venPos = dirFor(ven.lat, ven.lon).multiplyScalar(88);
        const isHovered = hoveredId === 'venus';

        return (
          <group position={venPos}>
            <mesh
              onClick={(e) => { e.stopPropagation(); onSelectBody?.(ven); }}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId('venus'); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHoveredId(null); document.body.style.cursor = ''; }}
            >
              <sphereGeometry args={[0.75, 24, 24]} />
              <meshBasicMaterial color="#fef9c3" />
            </mesh>
            {/* Bright diffraction diamond flare */}
            <mesh scale={1.6}>
              <sphereGeometry args={[0.75, 16, 16]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.4} blending={THREE.AdditiveBlending} />
            </mesh>

            <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{ opacity: isHovered ? 1 : 0.65 }}
                className="translate-y-5 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200/25 bg-black/80 px-2 py-0.5 text-[10px] font-mono text-zinc-200 shadow-lg backdrop-blur transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-200" />
                <span className="font-bold">VENUS</span>
                <span className="text-zinc-400">·</span>
                <span className="text-zinc-300">{ven.distAu.toFixed(2)} AU</span>
              </div>
            </Html>
          </group>
        );
      })()}

      {/* ============================================================== */}
      {/* 6. MERCURY                                                     */}
      {/* ============================================================== */}
      {(() => {
        const mer = planets.find((p) => p.id === 'mercury');
        if (!mer) return null;
        const merPos = dirFor(mer.lat, mer.lon).multiplyScalar(92);
        const isHovered = hoveredId === 'mercury';

        return (
          <group position={merPos}>
            <mesh
              onClick={(e) => { e.stopPropagation(); onSelectBody?.(mer); }}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId('mercury'); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHoveredId(null); document.body.style.cursor = ''; }}
            >
              <sphereGeometry args={[0.42, 16, 16]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.9} />
            </mesh>

            <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{ opacity: isHovered ? 1 : 0.55 }}
                className="translate-y-4 flex items-center gap-1 whitespace-nowrap rounded-full border border-white/20 bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300 shadow backdrop-blur transition-all"
              >
                <span>Mercury</span>
              </div>
            </Html>
          </group>
        );
      })()}

      {/* ============================================================== */}
      {/* 7. MARS'S NATURAL MOONS: PHOBOS & DEIMOS (Orbiting Mars in 3D)  */}
      {/* ============================================================== */}
      {/* Phobos (a = 9,376 km -> ~5.53 Three.js radius, orbit = 7.65 h) */}
      <group ref={phobosGroup}>
        {/* Phobos Orbit Line */}
        <Line
          points={Array.from({ length: 64 }, (_, i) => {
            const a = (i / 64) * Math.PI * 2;
            return [Math.cos(a) * 5.53, 0, Math.sin(a) * 5.53];
          })}
          color="#38bdf8"
          lineWidth={1}
          transparent
          opacity={0.3}
          dashed
          dashScale={12}
        />

        {/* Phobos Rock Mesh */}
        <group position={[5.53, 0, 0]}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onSelectBody?.({
                id: 'phobos',
                name: 'Phobos',
                type: 'moon',
                distKm: MOONS.phobos.aKm,
                description: 'The larger, innermost moon of Mars. Orbits closer to its planet than any other moon in the Solar System, rising in the west and setting in the east twice every Martian sol.',
                subtext: `Orbital period: ${MOONS.phobos.periodH} hours · Diameter: ${MOONS.phobos.diameterKm} km. Target of JAXA/NASA MMX sample return mission.`,
              });
            }}
            onPointerOver={(e) => { e.stopPropagation(); setHoveredId('phobos'); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHoveredId(null); document.body.style.cursor = ''; }}
          >
            <dodecahedronGeometry args={[0.08, 1]} />
            <meshStandardMaterial color="#a1a1aa" roughness={0.95} />
          </mesh>

          <Html center zIndexRange={[35, 0]} style={{ pointerEvents: 'none' }}>
            <div
              style={{ opacity: hoveredId === 'phobos' || camera.position.length() < 12 ? 1 : 0.6 }}
              className="translate-y-4 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-sky-400/30 bg-black/80 px-2 py-0.5 text-[10px] font-mono text-sky-200 shadow-md backdrop-blur transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span className="font-semibold">Phobos</span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-400">{MOONS.phobos.aKm.toLocaleString()} km</span>
            </div>
          </Html>
        </group>
      </group>

      {/* Deimos (a = 23,463 km -> ~13.84 Three.js radius, orbit = 30.3 h) */}
      <group ref={deimosGroup}>
        {/* Deimos Orbit Line */}
        <Line
          points={Array.from({ length: 96 }, (_, i) => {
            const a = (i / 96) * Math.PI * 2;
            return [Math.cos(a) * 13.84, 0, Math.sin(a) * 13.84];
          })}
          color="#f59e0b"
          lineWidth={0.8}
          transparent
          opacity={0.22}
          dashed
          dashScale={18}
        />

        {/* Deimos Rock Mesh */}
        <group position={[13.84, 0, 0]}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onSelectBody?.({
                id: 'deimos',
                name: 'Deimos',
                type: 'moon',
                distKm: MOONS.deimos.aKm,
                description: 'The smaller, outer moon of Mars. Orbits synchronously at 23,463 km with a smooth blanket of regolith filling its craters.',
                subtext: `Orbital period: ${MOONS.deimos.periodH} hours · Diameter: ${MOONS.deimos.diameterKm} km.`,
              });
            }}
            onPointerOver={(e) => { e.stopPropagation(); setHoveredId('deimos'); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHoveredId(null); document.body.style.cursor = ''; }}
          >
            <dodecahedronGeometry args={[0.055, 1]} />
            <meshStandardMaterial color="#d4d4d8" roughness={0.9} />
          </mesh>

          <Html center zIndexRange={[35, 0]} style={{ pointerEvents: 'none' }}>
            <div
              style={{ opacity: hoveredId === 'deimos' || camera.position.length() > 9 ? 1 : 0.6 }}
              className="translate-y-4 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-400/30 bg-black/80 px-2 py-0.5 text-[10px] font-mono text-amber-200 shadow-md backdrop-blur transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="font-semibold">Deimos</span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-400">{MOONS.deimos.aKm.toLocaleString()} km</span>
            </div>
          </Html>
        </group>
      </group>

      {/* ============================================================== */}
      {/* 8. NASA J2000 CONSTELLATION STARS                              */}
      {/* ============================================================== */}
      {stars.map((star) => {
        const starPos = dirFor(star.lat, star.lon).multiplyScalar(135);
        const isHovered = hoveredId === `star-${star.name}`;
        const starSize = Math.max(0.18, 0.45 - (star.mag + 1.5) * 0.08);

        return (
          <group key={star.name} position={starPos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelectBody?.({
                  id: star.name,
                  name: `${star.name} (${star.constellation})`,
                  type: 'star',
                  mag: star.mag,
                  color: star.color,
                  description: `Real navigational star from NASA J2000 catalog. Visual magnitude: ${star.mag}.`,
                  subtext: `Constellation: ${star.constellation}. Used by Mars rover star-trackers for autonomous celestial navigation.`,
                });
              }}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId(`star-${star.name}`); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHoveredId(null); document.body.style.cursor = ''; }}
            >
              <sphereGeometry args={[starSize, 12, 12]} />
              <meshBasicMaterial color={star.color} />
            </mesh>

            {/* Glowing twinkle halo on brightest stars */}
            {star.mag < 0.5 && (
              <mesh scale={2.2}>
                <sphereGeometry args={[starSize, 8, 8]} />
                <meshBasicMaterial color={star.color} transparent opacity={0.35} blending={THREE.AdditiveBlending} />
              </mesh>
            )}

            {/* Subtle Name Tag on Hover */}
            {isHovered && (
              <Html center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
                <div className="translate-y-4 whitespace-nowrap rounded-md border border-white/20 bg-black/85 px-2 py-0.5 text-[10px] font-mono text-white shadow-lg backdrop-blur">
                  <span className="font-bold text-amber-200">{star.name}</span>
                  <span className="text-zinc-400"> ({star.constellation})</span>
                  <span className="text-zinc-500"> · mag {star.mag}</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
