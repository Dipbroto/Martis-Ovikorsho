import { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  Activity, RefreshCw,
} from 'lucide-react';
import { playUiClick } from '../../utils/audioSynthesizer';
import { coreDeepHorizon } from '../../services/marsMlService';

/**
 * Calculates depth-resolved mechanical resistance, spindle torque, RPM,
 * and vibration physics across the 4 Martian stratigraphic horizons.
 * deepHorizon: the rock's deepest modelled horizon (an igneous interior drills harder than a sediment).
 */
export function getDepthDrillDynamics(depthMm, deepHorizon = null) {
  const z = Math.max(0, Math.min(55, Number(depthMm)));

  if (z < 3.5) {
    // Horizon 1: Surface Patina (0 - 3.5 mm) - Fine silt, dust, porous oxidized crust
    const u = z / 3.5;
    return {
      layerId: 'PATINA',
      layerName: 'Surface Patina',
      hardnessMohs: +(2.5 + 0.8 * u).toFixed(1),
      rpm: Math.round(3650 - 350 * u),
      torqueNm: +(2.0 + 0.6 * u).toFixed(1),
      impactEnergyJ: +(12.0 + 2.0 * u).toFixed(1),
      resistanceFactor: +(0.25 + 0.15 * u).toFixed(2),
      angularSpeedFactor: +(1.45 - 0.2 * u).toFixed(2),
      chatterIntensity: 0.008,
      axialHammerStroke: 0.025,
      sparkRate: 0.35,
      sparkColor: '#fb923c', // soft orange
      description: 'Low-friction eolian dust patina · Free spin mode',
    };
  }

  if (z < 22.0) {
    // Horizon 2: Pristine Crystalline Matrix (3.5 - 22.0 mm) - Hard basalt, augite, olivine crystals
    const u = (z - 3.5) / 18.5;
    // Hard mineral grains cause torque resistance ripples
    const grainWobble = Math.sin(u * Math.PI * 6);
    return {
      layerId: 'MATRIX',
      layerName: 'Crystalline Silicate Matrix',
      hardnessMohs: +(6.8 + 0.5 * grainWobble).toFixed(1),
      rpm: Math.round(2380 + 160 * grainWobble),
      torqueNm: +(6.5 + 0.9 * Math.abs(grainWobble)).toFixed(1),
      impactEnergyJ: +(28.5 + 4.0 * Math.abs(grainWobble)).toFixed(1),
      resistanceFactor: +(0.85 + 0.12 * Math.abs(grainWobble)).toFixed(2),
      angularSpeedFactor: +(0.72 + 0.08 * grainWobble).toFixed(2),
      chatterIntensity: 0.038, // heavy mechanical tooth chatter
      axialHammerStroke: 0.065, // heavy percussive stroke
      sparkRate: 1.0, // maximum spark bursts
      sparkColor: '#fde047', // brilliant white-yellow sparks
      description: 'High-strength crystalline basalt · Heavy torque load',
    };
  }

  if (z < 38.0) {
    // Horizon 3: Hydrothermal Vein (22.0 - 38.0 mm) - Soft bassanite/gypsum with brittle chalcedony silica
    const u = (z - 22.0) / 16.0;
    const veinBand = Math.sin(u * Math.PI * 8);
    const isHardSilicaVein = veinBand > 0.4;
    return {
      layerId: 'VEIN',
      layerName: 'Hydrothermal Secondary Vein',
      hardnessMohs: +(isHardSilicaVein ? 5.8 : 2.8).toFixed(1),
      rpm: Math.round(3100 - 650 * (veinBand > 0 ? veinBand : 0)),
      torqueNm: +(3.2 + 2.2 * Math.max(0, veinBand)).toFixed(1),
      impactEnergyJ: +(18.0 + 7.0 * Math.max(0, veinBand)).toFixed(1),
      resistanceFactor: +(0.45 + 0.35 * Math.max(0, veinBand)).toFixed(2),
      angularSpeedFactor: +(1.15 - 0.35 * Math.max(0, veinBand)).toFixed(2),
      chatterIntensity: 0.022,
      axialHammerStroke: 0.042,
      sparkRate: isHardSilicaVein ? 0.75 : 0.25,
      sparkColor: isHardSilicaVein ? '#38bdf8' : '#e2e8f0', // cyan/white dust
      description: 'Fractured sulfate vein with micro-crystalline silica',
    };
  }

  const u = (z - 38.0) / 17.0;

  // Horizon 4 of an igneous rock (38.0 - 55.0 mm): hard unweathered interior
  if (deepHorizon?.id === 'LAYER_DEEP_IGNEOUS') {
    return {
      layerId: 'DEEP_IGNEOUS',
      layerName: deepHorizon.shortName,
      hardnessMohs: +(6.4 + 0.3 * u).toFixed(1),
      rpm: Math.round(2300 - 120 * u),
      torqueNm: +(6.8 + 0.6 * u).toFixed(1),
      impactEnergyJ: +(29.0 + 2.5 * u).toFixed(1),
      resistanceFactor: +(0.88 + 0.08 * u).toFixed(2),
      angularSpeedFactor: +(0.7 - 0.05 * u).toFixed(2),
      chatterIntensity: 0.034,
      axialHammerStroke: 0.062,
      sparkRate: 0.9,
      sparkColor: '#fde047',
      description: 'Hard unweathered igneous interior · Heavy torque load',
    };
  }

  // Horizon 4 of a sediment (38.0 - 55.0 mm): compacted fine-grained laminae
  return {
    layerId: 'LAMINAE',
    layerName: deepHorizon?.shortName || 'Shielded Sediment Laminae',
    hardnessMohs: +(3.5 + 0.6 * u).toFixed(1),
    rpm: Math.round(2820 - 180 * u),
    torqueNm: +(4.2 + 0.8 * u).toFixed(1),
    impactEnergyJ: +(21.0 + 3.0 * u).toFixed(1),
    resistanceFactor: +(0.58 + 0.15 * u).toFixed(2),
    angularSpeedFactor: +(0.92 - 0.08 * u).toFixed(2),
    chatterIntensity: 0.014,
    axialHammerStroke: 0.048,
    sparkRate: 0.3,
    sparkColor: '#34d399', // emerald tinted clay dust
    description: 'Deep fine-grained sediment · Viscous overburden friction',
  };
}

/**
 * Procedural texture generator for authentic Martian rock core & titanium sleeve.
 */
function useProceduralCoreTextures() {
  return useMemo(() => {
    // 1. Rock Core Texture (4 Horizons baked into a continuous cylindrical UV texture)
    const rockCanvas = document.createElement('canvas');
    rockCanvas.width = 1024;
    rockCanvas.height = 256;
    const ctx = rockCanvas.getContext('2d');

    if (ctx) {
      // Base dark tone
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 1024, 256);

      // Layer 1: Patina (0% to 6.4% of width) - Oxidized reddish-orange ferric crust
      const patinaW = 1024 * 0.064;
      const patinaGrad = ctx.createLinearGradient(0, 0, patinaW, 0);
      patinaGrad.addColorStop(0, '#c2410c');
      patinaGrad.addColorStop(0.7, '#ea580c');
      patinaGrad.addColorStop(1, '#9a3412');
      ctx.fillStyle = patinaGrad;
      ctx.fillRect(0, 0, patinaW, 256);

      // Layer 2: Matrix (6.4% to 40% of width) - Basaltic pyroxene / olivine crystalline matrix
      const matrixX = patinaW;
      const matrixW = 1024 * 0.336;
      const matrixGrad = ctx.createLinearGradient(matrixX, 0, matrixX + matrixW, 0);
      matrixGrad.addColorStop(0, '#334155');
      matrixGrad.addColorStop(0.5, '#475569');
      matrixGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = matrixGrad;
      ctx.fillRect(matrixX, 0, matrixW, 256);

      // Layer 3: Hydrothermal Vein (40% to 69.1% of width) - Sulfate / opaline silica vein
      const veinX = matrixX + matrixW;
      const veinW = 1024 * 0.291;
      const veinGrad = ctx.createLinearGradient(veinX, 0, veinX + veinW, 0);
      veinGrad.addColorStop(0, '#0284c7');
      veinGrad.addColorStop(0.5, '#38bdf8');
      veinGrad.addColorStop(1, '#0369a1');
      ctx.fillStyle = veinGrad;
      ctx.fillRect(veinX, 0, veinW, 256);

      // Layer 4: Shielded Mudstone Laminae (69.1% to 100% of width) - Smectite clay
      const lamX = veinX + veinW;
      const lamW = 1024 - lamX;
      const lamGrad = ctx.createLinearGradient(lamX, 0, 1024, 0);
      lamGrad.addColorStop(0, '#047857');
      lamGrad.addColorStop(0.5, '#10b981');
      lamGrad.addColorStop(1, '#064e3b');
      ctx.fillStyle = lamGrad;
      ctx.fillRect(lamX, 0, lamW, 256);

      // Procedural rock grains & stippling
      const imgData = ctx.getImageData(0, 0, 1024, 256);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 45;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);

      // Fine transverse bedding laminae lines
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      for (let x = lamX; x < 1024; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (Math.random() - 0.5) * 6, 256);
        ctx.stroke();
      }
    }

    const rockTexture = new THREE.CanvasTexture(rockCanvas);
    rockTexture.wrapS = THREE.RepeatWrapping;
    rockTexture.wrapT = THREE.ClampToEdgeWrapping;

    // 2. Titanium Sleeve Texture with Laser Markings
    const tiCanvas = document.createElement('canvas');
    tiCanvas.width = 512;
    tiCanvas.height = 256;
    const tiCtx = tiCanvas.getContext('2d');
    if (tiCtx) {
      tiCtx.fillStyle = '#94a3b8';
      tiCtx.fillRect(0, 0, 512, 256);

      // Brushed titanium lines
      tiCtx.strokeStyle = 'rgba(255,255,255,0.15)';
      tiCtx.lineWidth = 1;
      for (let y = 0; y < 256; y += 4) {
        tiCtx.beginPath();
        tiCtx.moveTo(0, y);
        tiCtx.lineTo(512, y);
        tiCtx.stroke();
      }

      // Engraved millimeter ticks
      tiCtx.strokeStyle = 'rgba(0,0,0,0.5)';
      tiCtx.fillStyle = 'rgba(0,0,0,0.7)';
      tiCtx.font = 'bold 12px monospace';
      for (let x = 20; x < 500; x += 45) {
        tiCtx.beginPath();
        tiCtx.moveTo(x, 0);
        tiCtx.lineTo(x, 20);
        tiCtx.stroke();
        tiCtx.fillText(`${Math.round((x / 500) * 55)}mm`, x - 12, 34);
      }
      tiCtx.fillText('NASA PERSEVERANCE MSR TUBE #43', 140, 220);
    }
    const tiTexture = new THREE.CanvasTexture(tiCanvas);

    return { rockTexture, tiTexture };
  }, []);
}

/**
 * Dynamic Spark and Rock Debris Particles adapted to rock layer hardness and depth.
 */
function DrillingSparks({ isDrilling, dynamics, originX = -2.75 }) {
  const pointsRef = useRef();
  const count = 55;

  const [positions, velocities, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const baseColor = new THREE.Color(dynamics?.sparkColor || '#f59e0b');

    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = originX;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

      vel[i * 3] = (Math.random() - 0.7) * 4.0; // fly backwards
      vel[i * 3 + 1] = (Math.random() - 0.5) * 3.2;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 3.2;

      col[i * 3] = baseColor.r;
      col[i * 3 + 1] = baseColor.g;
      col[i * 3 + 2] = baseColor.b;
    }
    return [pos, vel, col];
  }, [count, originX, dynamics?.sparkColor]);

  useFrame((_, delta) => {
    if (!pointsRef.current || !isDrilling) return;
    const geom = pointsRef.current.geometry;
    const posArr = geom.attributes.position.array;
    const sparkRate = dynamics?.sparkRate || 1.0;

    for (let i = 0; i < count; i += 1) {
      posArr[i * 3] += velocities[i * 3] * delta * sparkRate;
      posArr[i * 3 + 1] += velocities[i * 3 + 1] * delta * sparkRate;
      posArr[i * 3 + 2] += velocities[i * 3 + 2] * delta * sparkRate;

      velocities[i * 3 + 1] -= 2.8 * delta;

      if (posArr[i * 3] < originX - 2.5 || Math.abs(posArr[i * 3 + 1]) > 2.0) {
        posArr[i * 3] = originX + (Math.random() - 0.5) * 0.1;
        posArr[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
        posArr[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      }
    }
    geom.attributes.position.needsUpdate = true;
  });

  if (!isDrilling) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Rotary Percussive Coring Drill Spindle & Diamond Crown Bit.
 * Strictly rotates coaxially around the longitudinal X-axis.
 */
function RotaryCoringDrillBit({ isDrilling, drillProgress = 0, activeDepthMm = 45.0 }) {
  const spindleGroupRef = useRef();

  const effectiveDepth = isDrilling ? (drillProgress / 100) * 55.0 : activeDepthMm;
  const dynamics = useMemo(() => getDepthDrillDynamics(effectiveDepth), [effectiveDepth]);

  useFrame((state, delta) => {
    if (!spindleGroupRef.current) return;

    const t = state.clock.getElapsedTime();

    if (isDrilling) {
      const torqueFluctuation = 1.0 - 0.16 * Math.pow(Math.sin(t * 14), 4);
      const currentAngularSpeed = 45 * dynamics.angularSpeedFactor * torqueFluctuation;
      spindleGroupRef.current.rotation.x += delta * currentAngularSpeed;

      const percussionOffset = Math.sin(t * 150) * dynamics.axialHammerStroke;
      const microChatterY = (Math.random() - 0.5) * dynamics.chatterIntensity;
      const microChatterZ = (Math.random() - 0.5) * dynamics.chatterIntensity;

      spindleGroupRef.current.position.x = -2.85 + (drillProgress / 100) * 0.8 + percussionOffset;
      spindleGroupRef.current.position.y = microChatterY;
      spindleGroupRef.current.position.z = microChatterZ;
    } else {
      const idleSpeed = 1.25 * dynamics.angularSpeedFactor;
      spindleGroupRef.current.rotation.x += delta * idleSpeed;

      spindleGroupRef.current.position.x = -3.2;
      spindleGroupRef.current.position.y = 0;
      spindleGroupRef.current.position.z = 0;
    }
  });

  return (
    <group ref={spindleGroupRef} position={[-3.2, 0, 0]}>
      {/* 1. Heavy Chuck Housing (Dark Carbon Steel) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.95, 1.05, 0.9, 32]} />
        <meshStandardMaterial
          color="#1e293b"
          metalness={0.95}
          roughness={0.25}
        />
      </mesh>

      {/* 2. Knurled Grip Flutes on Chuck */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.98, 0.98, 0.35, 16]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.9}
          roughness={0.4}
        />
      </mesh>

      {/* 3. Titanium Nitride (TiN) Gold Tapered Collar */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.55, 0, 0]}>
        <cylinderGeometry args={[0.78, 0.95, 0.3, 32]} />
        <meshStandardMaterial
          color="#eab308"
          metalness={0.92}
          roughness={0.18}
          emissive="#713f12"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* 4. Hollow Diamond/Carbide Coring Bit Tube (13 mm inner diameter) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.9, 0, 0]}>
        <cylinderGeometry args={[0.75, 0.75, 0.5, 32, 1, true]} />
        <meshStandardMaterial
          color="#64748b"
          metalness={0.88}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 5. Crown Teeth Flutes (Carbide Abrasive Cutters at the tip) */}
      <group position={[1.15, 0, 0]}>
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const y = Math.cos(angle) * 0.72;
          const z = Math.sin(angle) * 0.72;
          return (
            <mesh key={i} position={[0, y, z]} rotation={[angle, 0, 0]}>
              <boxGeometry args={[0.08, 0.12, 0.08]} />
              <meshStandardMaterial
                color="#f59e0b"
                metalness={0.95}
                roughness={0.15}
                emissive={dynamics.sparkColor}
                emissiveIntensity={isDrilling ? 2.0 : 0.3}
              />
            </mesh>
          );
        })}
      </group>

      {/* Active Drilling Spark Light */}
      {isDrilling && (
        <pointLight position={[1.2, 0, 0]} color={dynamics.sparkColor} intensity={3.5} distance={4} />
      )}
    </group>
  );
}

/**
 * Single Unified 3D 55 mm x 13 mm Cylindrical Titanium Core Tube & Stratigraphic Cutaway.
 * Concentric assembly: rock core is seated inside the titanium casing with an inspection cutaway window.
 * Strictly rotates around longitudinal X-axis only — CANNOT cross, tilt, or split into two tubes!
 */
function CylindricalRockCore({
  activeDepthMm,
  setActiveDepthMm,
  isDrilling,
  drillProgress = 0,
  textures,
}) {
  const tubeAssemblyRef = useRef();

  const CORE_LENGTH = 5.5;
  const CORE_RADIUS = 0.65;

  const currentDepthX = -2.75 + (Math.max(0, Math.min(55, activeDepthMm)) / 55.0) * CORE_LENGTH;
  const effectiveDepth = isDrilling ? (drillProgress / 100) * 55.0 : activeDepthMm;
  const dynamics = useMemo(() => getDepthDrillDynamics(effectiveDepth), [effectiveDepth]);

  useFrame((_, delta) => {
    if (!tubeAssemblyRef.current) return;

    // Strict longitudinal X-axis axial spin only!
    // Stays perfectly horizontal along X, rotating like a drill cylinder in place.
    const targetRollX = (activeDepthMm / 55.0) * Math.PI * 0.45;
    tubeAssemblyRef.current.rotation.x = THREE.MathUtils.damp(
      tubeAssemblyRef.current.rotation.x,
      targetRollX,
      4.0,
      delta
    );

    // Micro mechanical vibration transmitted into the core during drilling
    if (isDrilling) {
      tubeAssemblyRef.current.position.y = (Math.random() - 0.5) * dynamics.chatterIntensity * 0.3;
    } else {
      tubeAssemblyRef.current.position.y = 0;
    }
  });

  return (
    <group ref={tubeAssemblyRef} position={[0, 0, 0]}>
      {/* 1. Rock Core Interior Cylinder */}
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        position={[0, 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          const clickedX = e.point.x;
          const ratio = Math.max(0, Math.min(1, (clickedX - (-2.75)) / CORE_LENGTH));
          const newDepth = +(ratio * 55.0).toFixed(1);
          playUiClick?.();
          setActiveDepthMm(newDepth);
        }}
      >
        <cylinderGeometry args={[CORE_RADIUS, CORE_RADIUS, CORE_LENGTH, 64]} />
        <meshStandardMaterial
          map={textures.rockTexture}
          roughness={0.65}
          metalness={0.15}
        />
      </mesh>

      {/* Surface Face (0 mm) */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-2.75, 0, 0]}>
        <circleGeometry args={[CORE_RADIUS, 32]} />
        <meshStandardMaterial color="#c2410c" roughness={0.8} />
      </mesh>

      {/* Deep Base Face (55 mm) */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[2.75, 0, 0]}>
        <circleGeometry args={[CORE_RADIUS, 32]} />
        <meshStandardMaterial color="#064e3b" roughness={0.5} />
      </mesh>

      {/* 2. Titanium Outer Protective Sleeve with Top Cutaway Window */}
      {/* Snug concentric wrap around the rock core (radius 0.67 vs 0.65) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
        {/* Open top window: thetaStart = -Math.PI * 0.35, thetaLength = Math.PI * 1.3 */}
        <cylinderGeometry
          args={[CORE_RADIUS + 0.02, CORE_RADIUS + 0.02, CORE_LENGTH + 0.05, 64, 1, true, -Math.PI * 0.35, Math.PI * 1.3]}
        />
        <meshStandardMaterial
          map={textures.tiTexture}
          metalness={0.92}
          roughness={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Titanium End Seal Fitting Collar (Hermetic MSR Titanium Seal Ring) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[2.78, 0, 0]}>
        <cylinderGeometry args={[CORE_RADIUS + 0.05, CORE_RADIUS + 0.05, 0.15, 32]} />
        <meshStandardMaterial
          color="#cbd5e1"
          metalness={0.96}
          roughness={0.15}
        />
      </mesh>

      {/* 3. Interactive 3D Laser Depth Sensor Ring */}
      <group position={[currentDepthX, 0, 0]}>
        {/* Glowing Emerald Laser Annulus Ring */}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[CORE_RADIUS + 0.05, 0.02, 16, 48]} />
          <meshStandardMaterial
            color="#34d399"
            emissive="#10b981"
            emissiveIntensity={2.8}
            roughness={0.2}
          />
        </mesh>

        {/* Thin Translucent Laser Section Disc */}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[CORE_RADIUS + 0.04, 32]} />
          <meshBasicMaterial
            color="#10b981"
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Laser Point Light Illuminating Core at this Depth */}
        <pointLight color="#10b981" intensity={2.0} distance={2.5} />

        {/* 3D Floating Depth Tag */}
        <Html position={[0, CORE_RADIUS + 0.35, 0]} center>
          <div className="px-2 py-0.5 rounded-md bg-black/85 border border-emerald-400 text-[10px] font-mono text-emerald-300 font-bold pointer-events-none whitespace-nowrap shadow-[0_0_12px_rgba(16,185,129,0.5)] flex items-center gap-1.5 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{activeDepthMm.toFixed(1)} mm</span>
          </div>
        </Html>
      </group>

      {/* Active Drilling Spark Burst at drill bit tip */}
      <DrillingSparks isDrilling={isDrilling} dynamics={dynamics} originX={-2.75} />
    </group>
  );
}

/**
 * Camera Controller with Smooth Orbit Controls & Preset Framing.
 */
function CameraRig({ viewPreset = 'PERSPECTIVE' }) {
  const controlsRef = useRef();

  useEffect(() => {
    if (!controlsRef.current) return;
    if (viewPreset === 'BIT') {
      controlsRef.current.target.set(-2.8, 0, 0);
      controlsRef.current.object.position.set(-2.8, 1.2, 3.2);
    } else if (viewPreset === 'CUTAWAY') {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.object.position.set(0, 1.0, 5.5);
    } else if (viewPreset === 'MUDSTONE') {
      controlsRef.current.target.set(1.8, 0, 0);
      controlsRef.current.object.position.set(1.8, 1.0, 3.2);
    } else {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.object.position.set(0, 2.2, 6.2);
    }
    controlsRef.current.update();
  }, [viewPreset]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={2.5}
      maxDistance={12}
      maxPolarAngle={Math.PI / 2 + 0.3}
    />
  );
}

/**
 * Main 3D Core Drill & Titanium Tube Interactive WebGL Viewer.
 */
export default function CoreDrill3DViewer({
  target = null,
  activeDepthMm = 45.0,
  setActiveDepthMm,
  isDrilling = false,
  drillProgress = 0,
  handleActuateDrill,
  className = '',
}) {
  const [viewPreset, setViewPreset] = useState('PERSPECTIVE');
  const textures = useProceduralCoreTextures();

  const effectiveDepth = isDrilling ? (drillProgress / 100) * 55.0 : activeDepthMm;
  const deepHorizon = useMemo(() => coreDeepHorizon(target), [target]);
  const dynamics = useMemo(() => getDepthDrillDynamics(effectiveDepth, deepHorizon), [effectiveDepth, deepHorizon]);

  return (
    <div className={`relative rounded-2xl border border-emerald-500/30 bg-black/85 overflow-hidden shadow-2xl ${className}`}>
      {/* 3D WebGL Canvas */}
      <div className="relative w-full h-[360px] sm:h-[420px] cursor-grab active:cursor-grabbing select-none">
        <Canvas
          camera={{ position: [0, 2.2, 6.2], fov: 42 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          dpr={[1, 1.5]}
        >
          <color attach="background" args={['#030708']} />

          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 8, 5]} intensity={1.5} color="#fff1e6" />
          <directionalLight position={[-6, -4, -4]} intensity={0.4} color="#06b6d4" />
          <pointLight position={[0, 4, 3]} intensity={1.2} color="#10b981" />

          {/* 3D Scene Components */}
          <Suspense fallback={null}>
            {/* The Rotary Percussive Coring Drill Head */}
            <RotaryCoringDrillBit
              isDrilling={isDrilling}
              drillProgress={drillProgress}
              activeDepthMm={activeDepthMm}
            />

            {/* The 55 mm Concentric Titanium Core Tube & Stratigraphy Cutaway */}
            <CylindricalRockCore
              activeDepthMm={activeDepthMm}
              setActiveDepthMm={setActiveDepthMm}
              isDrilling={isDrilling}
              drillProgress={drillProgress}
              textures={textures}
            />
          </Suspense>

          {/* Camera Controller */}
          <CameraRig viewPreset={viewPreset} />
        </Canvas>

        {/* 3D Scene Interactive Overlay Badges with Live Physical Telemetry */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-2.5 py-1 rounded-lg bg-black/85 border border-emerald-500/40 backdrop-blur-md flex items-center gap-2 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono font-bold text-white tracking-wide">
                3D ROTARY PERCUSSIVE CORER (55 mm)
              </span>
            </div>

            {/* Dynamic Physical Telemetry Badge that Adapts with Depth Slider */}
            <div className={`px-2.5 py-1 rounded-lg backdrop-blur-md text-[10px] font-mono font-bold border flex items-center gap-2 shadow-md transition-colors ${
              isDrilling
                ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300 animate-pulse'
                : 'bg-black/80 border-white/15 text-zinc-300'
            }`}>
              <Activity className={`w-3.5 h-3.5 ${isDrilling ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`} />
              <span>SPINDLE: <strong className="text-white">{dynamics.rpm.toLocaleString()} RPM</strong></span>
              <span className="text-zinc-600">|</span>
              <span>TORQUE: <strong className="text-amber-300">{dynamics.torqueNm} N·m</strong></span>
              <span className="text-zinc-600">|</span>
              <span>HARDNESS: <strong className="text-cyan-300">{dynamics.hardnessMohs} Mohs</strong></span>
              <span className="hidden sm:inline text-zinc-600">|</span>
              <span className="hidden sm:inline text-zinc-400">{dynamics.layerName}</span>
            </div>
          </div>

          {/* Camera View Switcher Buttons */}
          <div className="flex items-center gap-1 bg-black/80 border border-white/10 rounded-xl p-1 backdrop-blur-md text-[10px] font-mono pointer-events-auto">
            <button
              onClick={() => { playUiClick?.(); setViewPreset('PERSPECTIVE'); }}
              className={`px-2 py-1 rounded-lg transition cursor-pointer font-bold ${
                viewPreset === 'PERSPECTIVE'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => { playUiClick?.(); setViewPreset('BIT'); }}
              className={`px-2 py-1 rounded-lg transition cursor-pointer font-bold ${
                viewPreset === 'BIT'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Drill Bit
            </button>
            <button
              onClick={() => { playUiClick?.(); setViewPreset('CUTAWAY'); }}
              className={`px-2 py-1 rounded-lg transition cursor-pointer font-bold ${
                viewPreset === 'CUTAWAY'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              55mm Cutaway
            </button>
            <button
              onClick={() => { playUiClick?.(); setViewPreset('MUDSTONE'); }}
              className={`px-2 py-1 rounded-lg transition cursor-pointer font-bold ${
                viewPreset === 'MUDSTONE'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Deep Laminae
            </button>
          </div>
        </div>

        {/* Bottom Floating Toolbar: Stratigraphy Info & Drill Actuator */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
          {/* Stratigraphic Layer Badge */}
          <div className="flex items-center gap-2 bg-black/80 border border-white/10 rounded-xl px-3 py-1.5 backdrop-blur-md text-[11px] font-mono">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dynamics.sparkColor }} />
            <span className="text-white font-bold">{dynamics.layerName}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400 hidden sm:inline text-[10px]">
              {dynamics.description}
            </span>
          </div>

          {/* Actuate Coring Drill Button with Dynamic Torque Speed */}
          <div className="flex items-center gap-2">
            <button
              disabled={isDrilling}
              onClick={handleActuateDrill}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-lg active:scale-95 ${
                isDrilling
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-emerald-500/25'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDrilling ? 'animate-spin' : ''}`} />
              <span>
                {isDrilling
                  ? `Drilling at ${dynamics.rpm.toLocaleString()} RPM (${drillProgress}%)…`
                  : `Actuate Rotary Corer (${dynamics.rpm.toLocaleString()} RPM)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
