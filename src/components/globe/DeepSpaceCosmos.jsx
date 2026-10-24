import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Line, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { getCelestialBodiesForGlobe, MOONS } from '../../utils/marsSky';

const R = 2; // Mars radius in Three.js space

/** Convert lat/lon on Mars sphere to 3D unit vector */
const dirFor = (lat, lon) => {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
};

/** Generate Saturn's multi-ring texture with the Cassini Division and Encke Gap */
function createRealisticSaturnRingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 512, 0);

  // Physically calibrated Cassini / Ring A / B / C opacity & color gradient
  grad.addColorStop(0.0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.08, 'rgba(125, 105, 80, 0.25)'); // Ring D / Crepe Ring C inner
  grad.addColorStop(0.24, 'rgba(180, 155, 120, 0.55)'); // Ring C outer
  grad.addColorStop(0.28, 'rgba(235, 215, 175, 0.88)'); // Ring B inner (bright & dense)
  grad.addColorStop(0.57, 'rgba(245, 225, 185, 0.96)'); // Ring B outer
  grad.addColorStop(0.59, 'rgba(12, 10, 8, 0.08)'); // Cassini Division (famous dark gap)
  grad.addColorStop(0.63, 'rgba(12, 10, 8, 0.08)'); // Cassini Division
  grad.addColorStop(0.65, 'rgba(220, 195, 155, 0.85)'); // Ring A inner
  grad.addColorStop(0.87, 'rgba(195, 170, 135, 0.72)');
  grad.addColorStop(0.89, 'rgba(15, 12, 8, 0.15)'); // Encke Gap
  grad.addColorStop(0.91, 'rgba(200, 175, 140, 0.65)'); // Ring A outer
  grad.addColorStop(0.96, 'rgba(160, 135, 100, 0.35)'); // Ring F fringe
  grad.addColorStop(1.0, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * RealisticSun Component:
 * Physically accurate star rendering featuring:
 * 1. NASA SDO Photosphere with dual-layer convective churn & Eddington limb darkening
 * 2. Blinding incandescent core falloff (blackbody thermal emission peak)
 * 3. Chromosphere fringe emission (H-alpha rim)
 * 4. Inverted Fresnel atmospheric glow (no hard sphere boundary)
 * 5. Procedural camera-oriented coronal streamers (solar wind plasma outflow)
 * 6. Optical diffraction glare spikes (spacecraft telescope optics)
 */
function RealisticSun({ sun, position, texture, onSelectBody, isHovered, onHoverChange }) {
  const { camera } = useThree();
  const meshRef = useRef();
  const coronaRef = useRef();
  const glareRef = useRef();

  // Custom Shader for the Photosphere with Eddington limb darkening,
  // convective churn, and chromospheric rim
  const photosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uTime: { value: 0 },
        uHover: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uTime;
        uniform float uHover;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          // Convective turbulence: dual opposing UV drift for boiling solar granulation
          vec2 uv1 = vec2(vUv.x + uTime * 0.002, vUv.y);
          vec2 uv2 = vec2(vUv.x * 2.2 - uTime * 0.0035, vUv.y * 2.2 + uTime * 0.0015);

          vec4 tex1 = texture2D(uMap, uv1);
          vec4 tex2 = texture2D(uMap, uv2);
          vec3 plasma = mix(tex1.rgb, tex2.rgb, 0.28);

          // Physical Eddington limb darkening: cos(theta) = dot(normal, viewDir)
          float mu = clamp(dot(vNormal, vViewDir), 0.0, 1.0);
          float limbDarkening = 0.40 + 0.60 * pow(mu, 0.65);

          // Blinding incandescent thermal emission at center of disk (T ~ 5778 K blackbody)
          vec3 incandescentCore = vec3(1.0, 0.98, 0.92);
          float coreGlow = pow(mu, 2.4);

          // Fiery chromospheric rim (ionized hydrogen-alpha rim at the grazing limb)
          float rimFactor = pow(1.0 - mu, 2.8);
          vec3 chromosphericRim = vec3(1.0, 0.42, 0.08) * 1.85;

          // Composite photosphere radiance
          vec3 color = plasma * limbDarkening;
          color = mix(color, incandescentCore, coreGlow * 0.62);
          color += chromosphericRim * rimFactor;

          gl_FragColor = vec4(color * (1.18 + uHover * 0.25), 1.0);
        }
      `,
    });
  }, [texture]);

  // Atmosphere shader for smooth chromospheric transition (eliminates hard edge)
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          // BackSide normals point inward toward center
          float mu = abs(dot(vNormal, vViewDir));
          float rim = pow(1.0 - mu, 3.2);
          float pulse = 0.96 + 0.04 * sin(uTime * 1.4);
          vec3 glowColor = mix(vec3(1.0, 0.78, 0.22), vec3(1.0, 0.35, 0.05), rim);
          gl_FragColor = vec4(glowColor * 1.6, rim * 0.55 * pulse);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // Camera-facing dynamic coronal streamers shader
  const coronaMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;

          float theta = atan(p.y, p.x);

          // Dynamic radial plasma streamers (solar wind magnetic outflow)
          float s1 = sin(theta * 11.0 + uTime * 0.28);
          float s2 = sin(theta * 23.0 - uTime * 0.18 + sin(theta * 4.0));
          float s3 = cos(theta * 37.0 + uTime * 0.42);
          float streamers = 0.75 + 0.16 * s1 + 0.10 * s2 + 0.06 * s3;

          // Double exponential decay: inner corona + extended solar wind
          float inner = exp(-r * 6.5);
          float outer = exp(-r * 2.4) * 0.35;
          float intensity = (inner + outer) * streamers;

          // Color ramp: incandescent white-gold -> luminous amber -> cosmic deep orange
          vec3 colInner = vec3(1.0, 0.96, 0.84);
          vec3 colMid = vec3(1.0, 0.68, 0.18);
          vec3 colOuter = vec3(0.92, 0.28, 0.04);

          vec3 color = mix(colInner, colMid, smoothstep(0.08, 0.45, r));
          color = mix(color, colOuter, smoothstep(0.45, 0.95, r));

          // Soft boundary fade
          float alpha = intensity * smoothstep(1.0, 0.35, r);
          gl_FragColor = vec4(color * 1.6, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // Optical diffraction spikes & anamorphic spacecraft flare
  const glareMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;

          // Anamorphic horizontal glare streak (characteristic of spacecraft optics)
          float hStreak = exp(-abs(p.y) * 48.0) * exp(-abs(p.x) * 1.8) * 0.42;

          // Vertical diffraction spike
          float vStreak = exp(-abs(p.x) * 48.0) * exp(-abs(p.y) * 1.8) * 0.32;

          // Diagonal 4-point cross (45 deg)
          vec2 rotP = vec2(p.x * 0.7071 - p.y * 0.7071, p.x * 0.7071 + p.y * 0.7071);
          float diagStreak = (exp(-abs(rotP.x) * 65.0) * exp(-abs(rotP.y) * 2.4) +
                              exp(-abs(rotP.y) * 65.0) * exp(-abs(rotP.x) * 2.4)) * 0.20;

          // Intense central optical blooming
          float centerBloom = exp(-r * 7.5) * 0.72;

          float totalGlow = (hStreak + vStreak + diagStreak + centerBloom) * smoothstep(1.0, 0.68, r);
          vec3 glareColor = mix(vec3(1.0, 0.98, 0.92), vec3(1.0, 0.72, 0.35), r);

          gl_FragColor = vec4(glareColor * 1.3, totalGlow * 0.7);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // Update uniforms and orientation per frame
  useFrame(({ clock, camera: currentCamera }) => {
    const t = clock.getElapsedTime();
    if (photosphereMaterial) {
      photosphereMaterial.uniforms.uTime.value = t;
      photosphereMaterial.uniforms.uHover.value = THREE.MathUtils.lerp(
        photosphereMaterial.uniforms.uHover.value,
        isHovered ? 1.0 : 0.0,
        0.1
      );
    }
    if (atmosphereMaterial) {
      atmosphereMaterial.uniforms.uTime.value = t;
    }
    if (coronaMaterial) {
      coronaMaterial.uniforms.uTime.value = t;
    }
    if (glareMaterial) {
      glareMaterial.uniforms.uTime.value = t;
    }

    // Solar axial rotation
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.02;
    }

    // Orient billboard coronal and glare quads to camera
    if (coronaRef.current) {
      coronaRef.current.quaternion.copy(currentCamera.quaternion);
    }
    if (glareRef.current) {
      glareRef.current.quaternion.copy(currentCamera.quaternion);
    }
  });

  return (
    <group position={position}>
      {/* 1. Solar Photosphere with Convective Churn & Limb Darkening */}
      <mesh
        ref={meshRef}
        material={photosphereMaterial}
        onClick={(e) => {
          e.stopPropagation();
          onSelectBody?.(sun);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverChange(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHoverChange(false);
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[3.4, 64, 64]} />
      </mesh>

      {/* 2. Inverted Chromospheric Atmosphere Halo */}
      <mesh material={atmosphereMaterial}>
        <sphereGeometry args={[3.85, 48, 48]} />
      </mesh>

      {/* 3. Camera-Facing Dynamic Coronal Streamers Quad */}
      <mesh ref={coronaRef} material={coronaMaterial}>
        <planeGeometry args={[38, 38]} />
      </mesh>

      {/* 4. Optical Diffraction Spikes & Glare Quad */}
      <mesh ref={glareRef} material={glareMaterial}>
        <planeGeometry args={[54, 54]} />
      </mesh>

      {/* 5. Tactical Ephemeris Readout */}
      <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{ opacity: isHovered || camera.position.length() > 8 ? 1 : 0.8 }}
          className="translate-y-8 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-400/30 bg-black/80 px-2.5 py-0.5 text-[11px] font-mono text-amber-200 shadow-xl backdrop-blur transition-all"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="font-bold">SUN</span>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-300">{sun.distAu.toFixed(2)} AU</span>
          <span className="text-amber-400/90 font-semibold">
            ({sun.lightMinutes.toFixed(1)}m light delay)
          </span>
        </div>
      </Html>
    </group>
  );
}

/**
 * Deep Space Cosmos Component:
 * Renders the real all-sky Milky Way galaxy skysphere, deep space galaxies (Andromeda,
 * Triangulum, Magellanic Clouds), nebulae, star clusters, real NASA/USGS planets,
 * and J2000 navigational stars from Mars's true orbital vantage point.
 */
export default function DeepSpaceCosmos({ now, subsolar, onSelectBody }) {
  const { camera } = useThree();

  // Load genuine all-sky Milky Way panorama and NASA/USGS planetary texture maps
  const textures = useTexture({
    milkyway: '/textures/milkyway-allsky-2k.jpg',
    sun: '/textures/planets/sun.jpg',
    earth: '/textures/planets/earth.jpg',
    moon: '/textures/planets/moon.jpg',
    jupiter: '/textures/planets/jupiter.jpg',
    saturn: '/textures/planets/saturn.jpg',
    venus: '/textures/planets/venus.jpg',
    mercury: '/textures/planets/mercury.jpg',
    phobos: '/textures/planets/phobos.png',
  });

  // Calibrate textures to sRGB color space and enable repeat wrapping
  useEffect(() => {
    Object.values(textures).forEach((tex) => {
      if (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.needsUpdate = true;
      }
    });
  }, [textures]);

  const saturnRingTexture = useMemo(() => createRealisticSaturnRingTexture(), []);

  // Custom Saturn Ring Geometry with Radial UV Mapping
  const saturnRingGeometry = useMemo(() => {
    const inner = 1.55;
    const outer = 2.85;
    const geo = new THREE.RingGeometry(inner, outer, 96, 12);
    const pos = geo.attributes.position;
    const uvs = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.sqrt(x * x + y * y);
      const u = (r - inner) / (outer - inner);
      uvs.setXY(i, u, 0.5);
    }
    uvs.needsUpdate = true;
    return geo;
  }, []);

  // Real NASA/JPL planetary, stellar, and deep-sky positions
  const { planets, stars, deepSky = [] } = useMemo(() => {
    return getCelestialBodiesForGlobe(now, subsolar);
  }, [now, subsolar]);

  const [hoveredId, setHoveredId] = useState(null);

  // Animation references
  const earthMesh = useRef();
  const moonMesh = useRef();
  const jupiterMesh = useRef();
  const jupiterMoonsGroup = useRef();
  const saturnMesh = useRef();
  const phobosGroup = useRef();
  const phobosMesh = useRef();
  const deimosGroup = useRef();

  // Astronomical rotations and orbital motion ticks
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Earth axial rotation (23.4° tilt)
    if (earthMesh.current) {
      earthMesh.current.rotation.y = t * 0.06;
    }

    // Moon's orbital revolution around Earth
    if (moonMesh.current) {
      const moonAngle = t * 0.28;
      moonMesh.current.position.set(
        Math.cos(moonAngle) * 2.3,
        Math.sin(moonAngle) * 0.45,
        Math.sin(moonAngle) * 2.3
      );
      moonMesh.current.rotation.y = moonAngle;
    }

    // Jupiter's fast rotation
    if (jupiterMesh.current) {
      jupiterMesh.current.rotation.y = t * 0.12;
    }

    // Jupiter's Galilean moons
    if (jupiterMoonsGroup.current) {
      jupiterMoonsGroup.current.rotation.y = t * 0.35;
    }

    // Saturn axial rotation (26.7° tilt)
    if (saturnMesh.current) {
      saturnMesh.current.rotation.y = t * 0.08;
    }

    // Phobos (fast orbit ~7.65 h)
    if (phobosGroup.current) {
      phobosGroup.current.rotation.y = t * 0.65;
    }
    if (phobosMesh.current) {
      phobosMesh.current.rotation.y = t * 0.65;
    }

    // Deimos (slower orbit ~30.3 h)
    if (deimosGroup.current) {
      deimosGroup.current.rotation.y = t * 0.16;
    }
  });

  return (
    <group name="deep-space-cosmos">
      {/* ============================================================== */}
      {/* 0. ALL-SKY 360° MILKY WAY GALAXY SKYSPHERE                     */}
      {/* ============================================================== */}
      <mesh
        rotation={[
          THREE.MathUtils.degToRad(62.87),
          THREE.MathUtils.degToRad(282.86),
          0,
        ]}
      >
        <sphereGeometry args={[270, 64, 48]} />
        <meshBasicMaterial
          map={textures.milkyway}
          side={THREE.BackSide}
          depthWrite={false}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* ============================================================== */}
      {/* 1. THE SUN (Physically Realistic Photosphere & Dynamic Corona) */}
      {/* ============================================================== */}
      {(() => {
        const sun = planets.find((p) => p.id === 'sun');
        if (!sun) return null;
        const sunPos = dirFor(sun.lat, sun.lon).multiplyScalar(125);

        return (
          <RealisticSun
            sun={sun}
            position={sunPos}
            texture={textures.sun}
            onSelectBody={onSelectBody}
            isHovered={hoveredId === 'sun'}
            onHoverChange={(h) => setHoveredId(h ? 'sun' : null)}
          />
        );
      })()}

      {/* ============================================================== */}
      {/* 2. EARTH & MOON (NASA Blue Marble Globe & Clementine Moon)     */}
      {/* ============================================================== */}
      {(() => {
        const earth = planets.find((p) => p.id === 'earth');
        if (!earth) return null;
        const earthPos = dirFor(earth.lat, earth.lon).multiplyScalar(95);
        const isHovered = hoveredId === 'earth';

        return (
          <group position={earthPos}>
            {/* Earth Group with 23.4° Axial Tilt */}
            <group rotation={[THREE.MathUtils.degToRad(23.4), 0, 0]}>
              <mesh
                ref={earthMesh}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBody?.(earth);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredId('earth');
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  setHoveredId(null);
                  document.body.style.cursor = '';
                }}
              >
                <sphereGeometry args={[1.1, 48, 48]} />
                <meshStandardMaterial
                  map={textures.earth}
                  roughness={0.65}
                  metalness={0.08}
                />
              </mesh>

              {/* Cyan Atmospheric Limb Glow (Rayleigh scattering rim) */}
              <mesh scale={1.045}>
                <sphereGeometry args={[1.1, 32, 32]} />
                <meshBasicMaterial
                  color="#38bdf8"
                  transparent
                  opacity={0.32}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            </group>

            {/* The Moon (Luna) with Genuine NASA Clementine/LRO Surface Map */}
            <mesh ref={moonMesh} position={[2.3, 0, 0]}>
              <sphereGeometry args={[0.3, 32, 32]} />
              <meshStandardMaterial
                map={textures.moon}
                roughness={0.92}
                metalness={0.02}
              />
            </mesh>

            {/* Moon Orbit Ring */}
            <Line
              points={Array.from({ length: 64 }, (_, i) => {
                const a = (i / 64) * Math.PI * 2;
                return [Math.cos(a) * 2.3, Math.sin(a) * 0.45, Math.sin(a) * 2.3];
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
                <span className="font-bold text-white">EARTH &amp; MOON</span>
                <span className="text-zinc-400">·</span>
                <span className="text-sky-300">{earth.distAu.toFixed(2)} AU</span>
                <span className="text-zinc-400 font-sans text-[10px]">
                  ({Math.round(earth.distKm / 1e6)}M km)
                </span>
              </div>
            </Html>
          </group>
        );
      })()}

      {/* ============================================================== */}
      {/* 3. JUPITER (NASA Cassini/Juno Mosaic & Galilean Moons)         */}
      {/* ============================================================== */}
      {(() => {
        const jup = planets.find((p) => p.id === 'jupiter');
        if (!jup) return null;
        const jupPos = dirFor(jup.lat, jup.lon).multiplyScalar(108);
        const isHovered = hoveredId === 'jupiter';

        return (
          <group position={jupPos}>
            {/* Giant Jovian Sphere with Real Belts & Great Red Spot */}
            <mesh
              ref={jupiterMesh}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBody?.(jup);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredId('jupiter');
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredId(null);
                document.body.style.cursor = '';
              }}
            >
              <sphereGeometry args={[1.55, 48, 48]} />
              <meshStandardMaterial map={textures.jupiter} roughness={0.75} />
            </mesh>

            {/* Galilean Moons in 3D Orbits: Io, Europa, Ganymede, Callisto */}
            <group ref={jupiterMoonsGroup}>
              {/* Io (Sulfur volcanic moon) */}
              <mesh position={[2.2, 0, 0]}>
                <sphereGeometry args={[0.075, 16, 16]} />
                <meshBasicMaterial color="#fef08a" />
              </mesh>
              {/* Europa (Icy white crust with cracks) */}
              <mesh position={[-2.8, 0.1, 0]}>
                <sphereGeometry args={[0.065, 16, 16]} />
                <meshBasicMaterial color="#f8fafc" />
              </mesh>
              {/* Ganymede (Largest solar system moon) */}
              <mesh position={[0, 0, 3.5]}>
                <sphereGeometry args={[0.095, 16, 16]} />
                <meshBasicMaterial color="#cbd5e1" />
              </mesh>
              {/* Callisto (Ancient heavily cratered dark ice) */}
              <mesh position={[0, -0.2, -4.3]}>
                <sphereGeometry args={[0.085, 16, 16]} />
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
      {/* 4. SATURN (NASA Cassini Atmosphere & 3D Tilted Radial Rings)   */}
      {/* ============================================================== */}
      {(() => {
        const sat = planets.find((p) => p.id === 'saturn');
        if (!sat) return null;
        const satPos = dirFor(sat.lat, sat.lon).multiplyScalar(115);
        const isHovered = hoveredId === 'saturn';

        return (
          <group position={satPos}>
            {/* Saturn Body with 26.7° Axial Tilt */}
            <group rotation={[THREE.MathUtils.degToRad(26.7), 0, THREE.MathUtils.degToRad(12)]}>
              <mesh
                ref={saturnMesh}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBody?.(sat);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredId('saturn');
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  setHoveredId(null);
                  document.body.style.cursor = '';
                }}
              >
                <sphereGeometry args={[1.25, 48, 48]} />
                <meshStandardMaterial map={textures.saturn} roughness={0.78} />
              </mesh>

              {/* Saturn 3D Concentric Ring System with Cassini Division & Encke Gap */}
              <mesh geometry={saturnRingGeometry} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial
                  map={saturnRingTexture}
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.94}
                  roughness={0.6}
                />
              </mesh>
            </group>

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
      {/* 5. VENUS (NASA Magellan Radar Terrain & Sulfuric Cloud Glow)   */}
      {/* ============================================================== */}
      {(() => {
        const ven = planets.find((p) => p.id === 'venus');
        if (!ven) return null;
        const venPos = dirFor(ven.lat, ven.lon).multiplyScalar(88);
        const isHovered = hoveredId === 'venus';

        return (
          <group position={venPos}>
            {/* Core Body with Magellan Radar Surface Map */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelectBody?.(ven);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredId('venus');
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredId(null);
                document.body.style.cursor = '';
              }}
            >
              <sphereGeometry args={[0.82, 36, 36]} />
              <meshStandardMaterial map={textures.venus} roughness={0.7} />
            </mesh>

            {/* Shimmering Sulfuric Acid Atmosphere Haze */}
            <mesh scale={1.03}>
              <sphereGeometry args={[0.82, 24, 24]} />
              <meshBasicMaterial
                color="#fef3c7"
                transparent
                opacity={0.38}
                blending={THREE.AdditiveBlending}
              />
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
      {/* 6. MERCURY (NASA MESSENGER Global Cratered Mosaic)             */}
      {/* ============================================================== */}
      {(() => {
        const mer = planets.find((p) => p.id === 'mercury');
        if (!mer) return null;
        const merPos = dirFor(mer.lat, mer.lon).multiplyScalar(92);
        const isHovered = hoveredId === 'mercury';

        return (
          <group position={merPos}>
            {/* Highly Detailed Cratered Terrestrial Body */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelectBody?.(mer);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredId('mercury');
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredId(null);
                document.body.style.cursor = '';
              }}
            >
              <sphereGeometry args={[0.48, 32, 32]} />
              <meshStandardMaterial map={textures.mercury} roughness={0.92} />
            </mesh>

            <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{ opacity: isHovered ? 1 : 0.55 }}
                className="translate-y-4 flex items-center gap-1 whitespace-nowrap rounded-full border border-white/20 bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300 shadow backdrop-blur transition-all"
              >
                <span className="font-semibold text-zinc-200">Mercury</span>
                <span className="text-zinc-400">· {mer.distAu.toFixed(2)} AU</span>
              </div>
            </Html>
          </group>
        );
      })()}

      {/* ============================================================== */}
      {/* 7. PHOBOS & DEIMOS (USGS Relief Mapped Moons of Mars)          */}
      {/* ============================================================== */}
      {/* Phobos: Triaxial Ellipsoid (27 × 22 × 18 km) with USGS Relief Map */}
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

        {/* Phobos Irregular Body */}
        <group position={[5.53, 0, 0]}>
          <mesh
            ref={phobosMesh}
            scale={[1.18, 0.95, 0.82]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBody?.({
                id: 'phobos',
                name: 'Phobos',
                type: 'moon',
                distKm: MOONS.phobos.aKm,
                description:
                  'The larger, innermost moon of Mars. Orbits closer to its planet than any other moon in the Solar System, rising in the west and setting in the east twice every Martian sol.',
                subtext: `Orbital period: ${MOONS.phobos.periodH} hours · Diameter: ${MOONS.phobos.diameterKm} km. Target of JAXA/NASA MMX sample return mission.`,
              });
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredId('phobos');
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHoveredId(null);
              document.body.style.cursor = '';
            }}
          >
            <sphereGeometry args={[0.09, 32, 32]} />
            <meshStandardMaterial
              map={textures.phobos}
              roughness={0.95}
              metalness={0.05}
            />
          </mesh>

          <Html center zIndexRange={[35, 0]} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                opacity: hoveredId === 'phobos' || camera.position.length() < 12 ? 1 : 0.6,
              }}
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

      {/* Deimos: Outer Synchronous Moon (15 × 12 × 11 km) */}
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

        {/* Deimos Body */}
        <group position={[13.84, 0, 0]}>
          <mesh
            scale={[1.15, 1.0, 0.88]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBody?.({
                id: 'deimos',
                name: 'Deimos',
                type: 'moon',
                distKm: MOONS.deimos.aKm,
                description:
                  'The smaller, outer moon of Mars. Orbits synchronously at 23,463 km with a smooth blanket of regolith filling its craters.',
                subtext: `Orbital period: ${MOONS.deimos.periodH} hours · Diameter: ${MOONS.deimos.diameterKm} km.`,
              });
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredId('deimos');
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHoveredId(null);
              document.body.style.cursor = '';
            }}
          >
            <sphereGeometry args={[0.06, 24, 24]} />
            <meshStandardMaterial color="#b4b4bc" roughness={0.92} />
          </mesh>

          <Html center zIndexRange={[35, 0]} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                opacity: hoveredId === 'deimos' || camera.position.length() > 9 ? 1 : 0.6,
              }}
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
      {/* 8. REAL DEEP-SKY GALAXIES & NEBULAE (Messier & NGC Catalogs)    */}
      {/* ============================================================== */}
      {deepSky.map((obj) => {
        const objPos = dirFor(obj.lat, obj.lon).multiplyScalar(140);
        const isHovered = hoveredId === `deepsky-${obj.id}`;

        return (
          <group key={obj.id} position={objPos}>
            {/* Luminous Astronomical Deep-Sky Object */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelectBody?.(obj);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredId(`deepsky-${obj.id}`);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredId(null);
                document.body.style.cursor = '';
              }}
            >
              <sphereGeometry args={[0.35, 16, 16]} />
              <meshBasicMaterial color={obj.color} />
            </mesh>

            {/* Diffuse Luminous Cloud / Disc Halo */}
            <mesh scale={2.4}>
              <sphereGeometry args={[0.35, 12, 12]} />
              <meshBasicMaterial
                color={obj.color}
                transparent
                opacity={0.3}
                blending={THREE.AdditiveBlending}
              />
            </mesh>

            {/* Tactical Deep-Sky Label */}
            <Html center zIndexRange={[32, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{ opacity: isHovered || camera.position.length() > 8 ? 1 : 0.6 }}
                className="translate-y-5 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-black/85 px-2 py-0.5 text-[10px] font-mono shadow-xl backdrop-blur transition-all"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: obj.color }}
                />
                <span className="font-bold text-white">{obj.shortName}</span>
                <span className="text-zinc-400">·</span>
                <span className="text-sky-300">
                  {obj.distLy >= 1000000
                    ? `${(obj.distLy / 1000000).toFixed(2)}M ly`
                    : `${(obj.distLy / 1000).toFixed(1)}k ly`}
                </span>
              </div>
            </Html>
          </group>
        );
      })}

      {/* ============================================================== */}
      {/* 9. NASA J2000 NAVIGATIONAL CONSTELLATION STARS                 */}
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
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredId(`star-${star.name}`);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredId(null);
                document.body.style.cursor = '';
              }}
            >
              <sphereGeometry args={[starSize, 12, 12]} />
              <meshBasicMaterial color={star.color} />
            </mesh>

            {/* Glowing twinkle halo on brightest stars */}
            {star.mag < 0.5 && (
              <mesh scale={2.2}>
                <sphereGeometry args={[starSize, 8, 8]} />
                <meshBasicMaterial
                  color={star.color}
                  transparent
                  opacity={0.35}
                  blending={THREE.AdditiveBlending}
                />
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
