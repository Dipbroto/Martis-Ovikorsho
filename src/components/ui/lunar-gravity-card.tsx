"use client";

import React, { useRef, useMemo, Suspense, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture, Environment } from "@react-three/drei";
import * as THREE from "three";
import { cn } from "@/lib/utils";

const RADIUS = 2.0;

// Procedural fallback texture generator in case remote texture is offline
function createMarsTextureCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#f0e6d6");
  grad.addColorStop(0.12, "#b24623");
  grad.addColorStop(0.5, "#d66232");
  grad.addColorStop(0.88, "#97371c");
  grad.addColorStop(1, "#f5efe8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  ctx.fillStyle = "rgba(70, 24, 15, 0.4)";
  ctx.beginPath();
  ctx.ellipse(320, 260, 220, 90, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(50, 18, 10, 0.5)";
  ctx.beginPath();
  ctx.ellipse(680, 290, 240, 100, -0.15, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = Math.random() * 2;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255, 180, 130, 0.25)" : "rgba(40, 15, 8, 0.3)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

const RealisticMars = ({ onClick }: { onClick?: () => void }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const fallbackCanvas = useMemo(() => createMarsTextureCanvas(), []);
  const fallbackTexture = useMemo(() => {
    const tex = new THREE.CanvasTexture(fallbackCanvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [fallbackCanvas]);

  const colorMap = useTexture(
    "/mars_texture.jpg",
    (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }
  );

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.05;
  });

  return (
    <mesh 
      ref={meshRef} 
      castShadow 
      receiveShadow 
      onClick={onClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }} 
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshStandardMaterial 
        map={colorMap || fallbackTexture} 
        bumpMap={colorMap || fallbackTexture} 
        bumpScale={0.035} 
        roughness={0.75}
        metalness={0.12}
      />
    </mesh>
  );
};

const particlesCount = 60000; 
const [ringPositions, ringColors, ringRandoms] = (() => {
  const pos = new Float32Array(particlesCount * 3);
  const col = new Float32Array(particlesCount * 3);
  const rnd = new Float32Array(particlesCount);

  for(let i=0; i<particlesCount; i++) {
    const angle = Math.random() * Math.PI * 2;

    const rDist = Math.pow(Math.random(), 1.5);
    const radius = 2.2 + rDist * 2.2; 

    const thickness = 0.4 - (rDist * 0.2); 
    const ySpread = (Math.random() + Math.random() + Math.random() - 1.5);
    const y = ySpread * thickness; 

    pos[i*3] = Math.cos(angle) * radius;
    pos[i*3+1] = y;
    pos[i*3+2] = Math.sin(angle) * radius;

    const intensity = 1.0 - rDist; 

    const paletteType = Math.random();
    let baseR, baseG, baseB;

    // Martian copper, amber, gold & cyan cosmic dust palette
    if (paletteType < 0.65) {
      baseR = 0.95; baseG = 0.38; baseB = 0.15; // Mars Rust
    } else if (paletteType < 0.88) {
      baseR = 0.98; baseG = 0.65; baseB = 0.20; // Amber Gold
    } else {
      baseR = 0.0; baseG = 0.85; baseB = 0.95; // Cyan Ion Stream
    }

    baseR = Math.min(1.0, Math.max(0.0, baseR + (Math.random() - 0.5) * 0.1));
    baseG = Math.min(1.0, Math.max(0.0, baseG + (Math.random() - 0.5) * 0.1));
    baseB = Math.min(1.0, Math.max(0.0, baseB + (Math.random() - 0.5) * 0.1));

    const sparkle = Math.random() > 0.95 ? 2.5 : 1.0;

    col[i*3] = baseR * intensity * sparkle;     
    col[i*3+1] = baseG * intensity * sparkle;   
    col[i*3+2] = baseB * intensity * sparkle;   
    rnd[i] = Math.random();
  }
  return [pos, col, rnd];
})();

const ParticleRing = ({ ringState, massiveAsteroidsRef }: { ringState: 'hidden' | 'animating' | 'visible', massiveAsteroidsRef: React.MutableRefObject<Float32Array> }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const uniforms = useRef({
    uProgress: { value: ringState === 'visible' ? 1.0 : 0.0 },
    uAsteroids: { value: new Float32Array(75 * 4) },
    time: { value: 0 }
  });

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y -= delta * 0.02;
      pointsRef.current.updateMatrix();

      const invMat = new THREE.Matrix4().copy(pointsRef.current.matrix).invert();
      const localAsteroids = new Float32Array(75 * 4);
      for(let i=0; i<75; i++) {
        const ast = new THREE.Vector3(
          massiveAsteroidsRef.current[i*4],
          massiveAsteroidsRef.current[i*4+1],
          massiveAsteroidsRef.current[i*4+2]
        );
        ast.applyMatrix4(invMat);
        localAsteroids[i*4] = ast.x;
        localAsteroids[i*4+1] = ast.y;
        localAsteroids[i*4+2] = ast.z;
        localAsteroids[i*4+3] = massiveAsteroidsRef.current[i*4+3];
      }
      uniforms.current.uAsteroids.value = localAsteroids;
    }
    uniforms.current.time.value = state.clock.elapsedTime;

    if (ringState === 'animating') {
      uniforms.current.uProgress.value += delta * 0.35; 
      if (uniforms.current.uProgress.value > 1.0) uniforms.current.uProgress.value = 1.0;
    } else if (ringState === 'visible') {
      uniforms.current.uProgress.value = 1.0;
    } else {
      uniforms.current.uProgress.value = 0.0;
    }
  });

  const onBeforeCompile = (shader: any) => {
    shader.uniforms.uProgress = uniforms.current.uProgress;
    shader.uniforms.uAsteroids = uniforms.current.uAsteroids;
    shader.uniforms.time = uniforms.current.time;

    shader.vertexShader = `
      uniform float uProgress;
      uniform vec4 uAsteroids[75];
      uniform float time;
      attribute float aRandom;
      varying float vProgress; 
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      `#include <begin_vertex>`,
      `
      vec3 transformed = vec3(position);

      float angle = atan(transformed.x, transformed.z);
      float normalizedAngle = abs(angle) / 3.14159265359;
      float spawnThreshold = 1.0 - normalizedAngle; 

      float progressValue = (uProgress * 1.4) - spawnThreshold;
      float particleProgress = smoothstep(0.0, 0.4, progressValue);
      vProgress = particleProgress;

      transformed.y += sin(angle * 10.0 + time) * 0.05 * aRandom;

      if (uProgress > 0.5) {
        for(int i = 0; i < 75; i++) {
          vec4 astData = uAsteroids[i];
          vec3 delta = transformed - astData.xyz;
          float dist = length(delta);

          float rad = astData.w * 2.0 + 0.15;

          if (dist < rad) {
             float force = pow((rad - dist) / rad, 2.0); 
             transformed += normalize(delta) * force * 0.4;
             transformed.y += force * 0.20 * (aRandom - 0.5);
          }
        }
      }

      float swirl = (1.0 - particleProgress) * 4.0; 
      float s = sin(swirl);
      float c = cos(swirl);
      transformed.xz = mat2(c, -s, s, c) * transformed.xz;

      transformed.y += (1.0 - particleProgress) * (transformed.y >= 0.0 ? 1.0 : -1.0);

      vec3 moonSurface = normalize(transformed) * 2.1;
      transformed = mix(moonSurface, transformed, particleProgress);
      `
    );

    shader.fragmentShader = `
      varying float vProgress;
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <color_fragment>`,
      `
      #include <color_fragment>

      diffuseColor.a *= vProgress;
      `
    );
  };

  return (
    <points ref={pointsRef} rotation={[-Math.PI / 2, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute 
          attach="attributes-position" 
          count={particlesCount}
          array={ringPositions}
          itemSize={3}
          args={[ringPositions, 3]}
        />
        <bufferAttribute 
          attach="attributes-color" 
          count={particlesCount}
          array={ringColors}
          itemSize={3}
          args={[ringColors, 3]}
        />
        <bufferAttribute 
          attach="attributes-aRandom" 
          count={particlesCount}
          array={ringRandoms}
          itemSize={1}
          args={[ringRandoms, 1]}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.008} 
        vertexColors 
        transparent 
        opacity={0.8} 
        sizeAttenuation={true} 
        blending={THREE.AdditiveBlending} 
        depthWrite={false} 
        onBeforeCompile={onBeforeCompile} 
      />
    </points>
  );
};

const generateAsteroids = (count: number) => {
  const data = [];
  for (let i = 0; i < count; i++) {
    const baseRadius = 2.8 + Math.random() * 2.0; 
    const radialAmplitude = 0.5 + Math.random() * 1.5; 
    const radialSpeed = 0.15 + Math.random() * 0.25; 
    const phase = Math.random() * Math.PI * 2;

    const angle = Math.random() * Math.PI * 2;
    const zOffset = (Math.random() - 0.5) * 0.8; 

    const speed = (0.04 + Math.random() * 0.08) * (Math.random() > 0.5 ? 1 : -1);

    const rotationSpeedX = (Math.random() - 0.5) * 0.05;
    const rotationSpeedY = (Math.random() - 0.5) * 0.05;
    const rotationSpeedZ = (Math.random() - 0.5) * 0.05;

    const scale = 0.02 + Math.pow(Math.random(), 4) * 0.18;

    data.push({
      angle, baseRadius, radialAmplitude, radialSpeed, phase, zOffset, speed,
      rx: Math.random() * Math.PI, ry: Math.random() * Math.PI, rz: Math.random() * Math.PI,
      rsx: rotationSpeedX, rsy: rotationSpeedY, rsz: rotationSpeedZ,
      scale
    });
  }
  data.sort((a, b) => b.scale - a.scale);
  return data;
};

const AsteroidBelt = ({ ringState, massiveAsteroidsRef }: { ringState: 'hidden' | 'animating' | 'visible', massiveAsteroidsRef: React.MutableRefObject<Float32Array> }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const [colorMap, bumpMap] = useTexture([
    '/mars_texture.jpg',
    '/mars_texture.jpg'
  ]);

  const count = 75; 
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [asteroids] = useState(() => generateAsteroids(count));
  const scaleRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const targetScale = ringState === 'hidden' ? 0 : 1;
    const lerpSpeed = ringState === 'hidden' ? 5 : 2;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, delta * lerpSpeed);

    if (scaleRef.current < 0.01) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    asteroids.forEach((ast, i) => {
      ast.angle += ast.speed * delta; 
      ast.phase += ast.radialSpeed * delta;
      let currentRadius = ast.baseRadius + Math.sin(ast.phase) * ast.radialAmplitude;

      if (currentRadius < 2.15) {
        const penetration = 2.15 - currentRadius;
        currentRadius = 2.15 + penetration * 0.85;
      }

      const x = Math.cos(ast.angle) * currentRadius;
      const y = Math.sin(ast.angle) * currentRadius;

      massiveAsteroidsRef.current[i * 4] = x;
      massiveAsteroidsRef.current[i * 4 + 1] = y;
      massiveAsteroidsRef.current[i * 4 + 2] = ast.zOffset;
      massiveAsteroidsRef.current[i * 4 + 3] = ast.scale;

      ast.rx += ast.rsx;
      ast.ry += ast.rsy;
      ast.rz += ast.rsz;

      dummy.position.set(x, y, ast.zOffset);
      dummy.rotation.set(ast.rx, ast.ry, ast.rz);
      dummy.scale.setScalar(ast.scale * scaleRef.current);
      dummy.updateMatrix();

      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial 
        map={colorMap} 
        bumpMap={bumpMap} 
        bumpScale={0.08}
        color="#ffffff"
        roughness={0.7}
        metalness={0.1}
      />
    </instancedMesh>
  );
};

export interface LunarGravityCardProps {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  onSelectTab?: (tab: string) => void;
}

export default function LunarGravityCard({ 
  className,
  title = (
    <>
      <span className="text-zinc-100 drop-shadow-sm font-display tracking-tight">Mars</span>
      <br />
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff8c69] via-[#f16938] to-[#ff4500] drop-shadow-[0_4px_25px_rgba(241,105,56,0.5)] font-display font-black tracking-tight">
        Gravity.
      </span>
    </>
  ),
  description = "Interactive Martian astrodynamics. Orbiting accretion particle rings, relativistic gravitational field simulation, and real-time planetary physics.",
  onSelectTab
}: LunarGravityCardProps) {
  const [ringState, setRingState] = useState<'hidden' | 'animating' | 'visible'>('hidden');
  const massiveAsteroidsRef = useRef<Float32Array>(new Float32Array(75 * 4));

  return (
    <div className={cn("w-full h-screen min-h-screen relative overflow-hidden bg-[#030407] select-none flex flex-col justify-between", className)}>
      
      {/* 3D Canvas across the entire screen */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto">
        <Canvas shadows camera={{ position: [0, 3.2, 10.5], fov: 42 }} dpr={[1, 1.5]}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[12, 7, 7]} intensity={2.4} color="#fff4e8" castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-8, -5, -6]} intensity={0.4} color="#00e5ff" />

          <OrbitControls 
            enableZoom={false} 
            enablePan={false} 
            autoRotate={false} 
            rotateSpeed={0.8}
          />

          <group rotation={[Math.PI / 8, 0, 0]}>
            <Suspense fallback={null}>
              <RealisticMars onClick={() => { if(ringState === 'hidden') setRingState('animating'); }} />
              <ParticleRing ringState={ringState} massiveAsteroidsRef={massiveAsteroidsRef} />
              <AsteroidBelt ringState={ringState} massiveAsteroidsRef={massiveAsteroidsRef} />
            </Suspense>
          </group>
        </Canvas>
      </div>

      {/* Atmospheric lighting & gradient masks for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#030407]/95 via-[#030407]/60 md:via-[#030407]/25 to-transparent pointer-events-none z-10 w-full md:w-[60%]" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#030407] via-[#030407]/60 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#030407]/80 to-transparent pointer-events-none z-10" />

      {/* Floating HUD Interface Layer */}
      <div className="relative z-20 flex-1 flex flex-col justify-between w-full pointer-events-none pt-24 md:pt-28 pb-6 px-6 sm:px-12 md:px-16 lg:px-20 max-w-7xl mx-auto">
        
        {/* Main Hero Header & CTA Buttons */}
        <div className="my-auto max-w-xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-4 pointer-events-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f16938] animate-ping" />
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] font-bold text-[#ff8c69] bg-[#f16938]/15 px-3 py-1 rounded-full border border-[#f16938]/30 backdrop-blur-md shadow-[0_0_15px_rgba(241,105,56,0.2)]">
              ARES RELATIVISTIC GRAVITY FIELD
            </span>
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight leading-[0.92] mb-5 text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.9)]">
            {title}
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base md:text-lg text-zinc-300 font-normal leading-relaxed mb-8 drop-shadow-md max-w-lg">
            {description}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3.5 pointer-events-auto">
            <button
              onClick={() => {
                setRingState(ringState === 'hidden' ? 'animating' : 'hidden');
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#f16938] to-[#e64a19] hover:from-[#ff7b4d] hover:to-[#f4511e] text-white font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-[0_0_25px_rgba(241,105,56,0.45)] hover:shadow-[0_0_35px_rgba(241,105,56,0.7)] cursor-pointer flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {ringState === 'hidden' ? 'Trigger Ring Event' : 'Collapse Ring'}
            </button>

            {onSelectTab && (
              <button
                onClick={() => onSelectTab('map')}
                className="px-5 py-3 rounded-xl bg-[#0B0C10]/80 hover:bg-[#1f2833]/90 border border-cyber-cyan/50 hover:border-cyber-cyan text-cyber-cyan font-mono text-xs uppercase tracking-wider font-semibold transition-all backdrop-blur-md shadow-[0_0_15px_rgba(0,240,255,0.2)] cursor-pointer"
              >
                Launch 3D Cartography Map →
              </button>
            )}

            <span className="text-[11px] font-mono text-zinc-400 block sm:inline mt-1 sm:mt-0">
              (Drag to rotate in 3D • Click globe)
            </span>
          </div>
        </div>

        {/* Bottom Sci-Fi Telemetry Cards */}
        <div className="pointer-events-auto grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/[0.08] backdrop-blur-sm">
          <div className="bg-[#0B0C10]/60 border border-white/[0.06] rounded-xl px-4 py-2.5">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Surface Gravity</div>
            <div className="text-sm sm:text-base font-mono font-bold text-white mt-0.5">0.379 g <span className="text-xs text-zinc-500">(3.72 m/s²)</span></div>
          </div>
          <div className="bg-[#0B0C10]/60 border border-white/[0.06] rounded-xl px-4 py-2.5">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Martian Sol</div>
            <div className="text-sm sm:text-base font-mono font-bold text-white mt-0.5">24h 39m 35s</div>
          </div>
          <div className="bg-[#0B0C10]/60 border border-white/[0.06] rounded-xl px-4 py-2.5">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Orbital Radius</div>
            <div className="text-sm sm:text-base font-mono font-bold text-[#ff8c69] mt-0.5">227.9M km</div>
          </div>
          <div className="bg-[#0B0C10]/60 border border-white/[0.06] rounded-xl px-4 py-2.5">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Field State</div>
            <div className="text-sm sm:text-base font-mono font-bold text-cyber-cyan mt-0.5 flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", ringState === 'hidden' ? "bg-emerald-400" : "bg-amber-400 animate-ping")} />
              {ringState === 'hidden' ? 'STABLE CORE' : 'ACCRETION'}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export { LunarGravityCard as Component };
