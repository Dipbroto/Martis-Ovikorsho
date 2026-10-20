import React, { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';
import { 
  Compass, Globe, Rocket, Shield, Activity, Thermometer, Wind, Eye, 
  MapPin, ArrowRight, Sparkles, Orbit, Mountain, Sun, Zap, Satellite, 
  Radio, RadioTower, CheckCircle2, RotateCw, Play, Pause, Flame
} from 'lucide-react';

// Coordinates mapping onto sphere
const latLonToVector3 = (lat, lon, radius) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
};

// Procedural fallback texture generator
function createProceduralMarsTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#e5d9c8'); // North polar ice
  grad.addColorStop(0.12, '#a74323');
  grad.addColorStop(0.5, '#c85a2d'); // Red planet surface
  grad.addColorStop(0.88, '#92341a');
  grad.addColorStop(1, '#f1ede6'); // South polar ice
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Surface dark mare patches & craters
  ctx.fillStyle = 'rgba(70, 24, 15, 0.4)';
  ctx.beginPath();
  ctx.ellipse(320, 260, 220, 90, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(50, 18, 10, 0.5)';
  ctx.beginPath();
  ctx.ellipse(680, 290, 240, 100, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Noise specks
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = Math.random() * 2;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 180, 130, 0.25)' : 'rgba(40, 15, 8, 0.3)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 4 Iconic Martian Hotspots
const HERO_HOTSPOTS = [
  {
    id: 'jezero',
    name: 'Jezero Crater Delta',
    rover: 'Perseverance Outpost',
    lat: 18.4447,
    lon: 77.4508,
    elev: '-2.6 km',
    color: '#00f0ff',
    desc: 'Ancient river delta & lake basin rich in clay minerals.'
  },
  {
    id: 'olympus',
    name: 'Olympus Mons',
    rover: 'Solar Apex Volcano',
    lat: 18.6500,
    lon: -133.8000,
    elev: '+21.2 km',
    color: '#ff5522',
    desc: 'Largest shield volcano in the solar system, summit caldera.'
  },
  {
    id: 'valles',
    name: 'Valles Marineris',
    rover: 'Grand Canyon Network',
    lat: -14.0000,
    lon: -59.2000,
    elev: '-5.0 km',
    color: '#f59e0b',
    desc: '4,000 km long tectonic rift chasm network.'
  },
  {
    id: 'gale',
    name: 'Gale Crater',
    rover: 'Curiosity Field Base',
    lat: -4.5895,
    lon: 137.4417,
    elev: '-4.5 km',
    color: '#10b981',
    desc: 'Mount Sharp sedimentary layers recording ancient lakes.'
  }
];

// Inner 3D Mars Planet Component
function MarsGlobeMesh({ 
  activeHotspot, 
  dustStormActive, 
  autoRotate, 
  showMoons,
  showAtmosphere
}) {
  const globeGroupRef = useRef();
  const dustParticlesRef = useRef();
  const phobosOrbitRef = useRef();
  const deimosOrbitRef = useRef();

  // Load texture or fallback safely
  const marsTexture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    try {
      const tex = loader.load('/mars_texture.jpg');
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    } catch {
      return createProceduralMarsTexture();
    }
  }, []);

  // Frame animation loop
  useFrame((_, delta) => {
    if (autoRotate && globeGroupRef.current) {
      globeGroupRef.current.rotation.y += delta * (dustStormActive ? 0.22 : 0.12);
    }

    if (dustParticlesRef.current) {
      dustParticlesRef.current.rotation.y += delta * (dustStormActive ? 0.45 : 0.08);
      dustParticlesRef.current.rotation.x += delta * 0.04;
    }

    if (phobosOrbitRef.current) {
      phobosOrbitRef.current.rotation.y += delta * 0.75;
    }

    if (deimosOrbitRef.current) {
      deimosOrbitRef.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <group>
      {/* Central Rotating Mars Body */}
      <group ref={globeGroupRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[2.0, 48, 48]} />
          <meshStandardMaterial
            map={marsTexture}
            roughness={0.85}
            metalness={0.1}
          />
        </mesh>

        {/* Atmospheric Glow Shell */}
        {showAtmosphere && (
          <mesh>
            <sphereGeometry args={[2.06, 32, 32]} />
            <meshBasicMaterial
              color={dustStormActive ? '#ff4411' : '#ff7a50'}
              transparent
              opacity={dustStormActive ? 0.35 : 0.18}
              side={THREE.BackSide}
            />
          </mesh>
        )}

        {/* Hotspot Markers on Mars Surface */}
        {HERO_HOTSPOTS.map((spot) => {
          const pos = latLonToVector3(spot.lat, spot.lon, 2.02);
          const isSelected = activeHotspot?.id === spot.id;

          return (
            <group key={spot.id} position={pos}>
              <mesh>
                <sphereGeometry args={[isSelected ? 0.06 : 0.04, 16, 16]} />
                <meshBasicMaterial color={spot.color} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Orbiting Moon 1: Phobos */}
      {showMoons && (
        <group ref={phobosOrbitRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.78, 2.80, 48]} />
            <meshBasicMaterial color="#ff7a50" transparent opacity={0.15} side={THREE.DoubleSide} />
          </mesh>

          <group position={[2.79, 0, 0]}>
            <mesh>
              <dodecahedronGeometry args={[0.065, 0]} />
              <meshStandardMaterial color="#9c8c7c" roughness={0.9} />
            </mesh>
          </group>
        </group>
      )}

      {/* Orbiting Moon 2: Deimos */}
      {showMoons && (
        <group ref={deimosOrbitRef} rotation={[0.2, 0.1, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3.68, 3.70, 48]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.12} side={THREE.DoubleSide} />
          </mesh>

          <group position={[3.69, 0, 0]}>
            <mesh>
              <dodecahedronGeometry args={[0.045, 0]} />
              <meshStandardMaterial color="#b0a294" roughness={0.9} />
            </mesh>
          </group>
        </group>
      )}

      {/* Cosmic Dust Field */}
      <points ref={dustParticlesRef}>
        <sphereGeometry args={[2.8, 16, 16]} />
        <pointsMaterial
          size={dustStormActive ? 0.035 : 0.02}
          color={dustStormActive ? '#ff5522' : '#00f0ff'}
          transparent
          opacity={dustStormActive ? 0.65 : 0.35}
        />
      </points>
    </group>
  );
}

export default function InteractiveMarsHero() {
  const setActiveTab = useMapStore(s => s.setActiveTab);
  const setMapCenter = useMapStore(s => s.setMapCenter);
  const setMapZoom = useMapStore(s => s.setMapZoom);
  const setViewMode = useMapStore(s => s.setViewMode);
  const weather = useMapStore(s => s.weather);
  const currentSol = useMapStore(s => s.currentSol);

  // Interactive 3D Canvas States
  const [activeHotspot, setActiveHotspot] = useState(HERO_HOTSPOTS[0]);
  const [autoRotate, setAutoRotate] = useState(true);
  const [dustStormActive, setDustStormActive] = useState(false);
  const [showMoons, setShowMoons] = useState(true);
  const [showAtmosphere, setShowAtmosphere] = useState(true);

  const handleToggleDust = () => {
    marsAudio.playUiClick?.();
    setDustStormActive(!dustStormActive);
  };

  const handleSelectHotspot = (spot) => {
    setActiveHotspot(spot);
    marsAudio.playQuindarTone?.(false);
  };

  const handleLaunchToSpot = (spot) => {
    marsAudio.playQuindarTone?.(true);
    setMapCenter([spot.lat, spot.lon]);
    setMapZoom(4);
    setActiveTab('map');
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,0.85)] min-h-[560px] bg-[#07090F]">
      
      {/* 3D WebGL Canvas Layer (Directly Interactive) */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 5.8], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 1.5]}
        >
          <ambientLight intensity={0.45} />
          <directionalLight position={[6, 3, 4]} intensity={2.4} color="#fff1e0" />
          <directionalLight position={[-5, -2, -3]} intensity={0.3} color="#182848" />

          <Stars radius={100} depth={50} count={2500} factor={4} saturation={0.5} fade speed={1} />

          <Suspense fallback={null}>
            <MarsGlobeMesh
              activeHotspot={activeHotspot}
              dustStormActive={dustStormActive}
              autoRotate={autoRotate}
              showMoons={showMoons}
              showAtmosphere={showAtmosphere}
            />
          </Suspense>

          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={3.8}
            maxDistance={8.5}
            rotateSpeed={0.6}
            dampingFactor={0.05}
          />
        </Canvas>
      </div>

      {/* Atmospheric Vignette Gradients (Pointer Events None so orbit controls work) */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#07090F]/95 via-[#07090F]/70 to-transparent pointer-events-none z-10 w-full sm:w-[65%] lg:w-[50%]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#07090F] to-transparent pointer-events-none z-10" />

      {/* Top 3D Interactive Control Pill Ribbon (Floating Top-Right) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 flex-wrap justify-end pointer-events-auto">
        {/* Toggle Dust Storm Simulation */}
        <button
          onClick={handleToggleDust}
          className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all backdrop-blur-xl border cursor-pointer ${
            dustStormActive
              ? 'bg-red-950/80 text-red-300 border-red-500/80 shadow-[0_0_16px_rgba(244,63,94,0.4)] animate-pulse'
              : 'bg-black/60 hover:bg-[#101522]/90 text-stone-300 border-white/10 hover:border-white/30'
          }`}
          title="Toggle Global Dust Storm Particle Squall"
        >
          <Flame className={`w-3.5 h-3.5 ${dustStormActive ? 'text-red-400' : 'text-stone-400'}`} />
          <span>{dustStormActive ? 'Dust Storm ACTIVE' : 'Simulate Dust'}</span>
        </button>

        {/* Toggle Moons (Phobos & Deimos) */}
        <button
          onClick={() => {
            marsAudio.playUiClick?.();
            setShowMoons(!showMoons);
          }}
          className={`px-2.5 py-1.5 rounded-xl font-mono text-[11px] font-medium uppercase tracking-wider flex items-center gap-1.5 transition-all backdrop-blur-xl border cursor-pointer ${
            showMoons 
              ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/50' 
              : 'bg-black/60 text-stone-400 border-white/10'
          }`}
          title="Toggle Phobos & Deimos Orbital Radii"
        >
          <Orbit className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Moons</span>
        </button>

        {/* Toggle Auto Rotation */}
        <button
          onClick={() => {
            marsAudio.playUiClick?.();
            setAutoRotate(!autoRotate);
          }}
          className={`p-1.5 rounded-xl font-mono text-[11px] transition-all backdrop-blur-xl border cursor-pointer ${
            autoRotate 
              ? 'bg-amber-950/50 text-amber-300 border-amber-500/50' 
              : 'bg-black/60 text-stone-400 border-white/10'
          }`}
          title={autoRotate ? 'Pause Planet Rotation' : 'Resume Planet Rotation'}
        >
          {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Main Hero Foreground Content: Pointer Events None container with auto on interactive children */}
      <div className="relative z-20 w-full p-6 sm:p-10 lg:p-12 flex flex-col justify-between min-h-[560px] pointer-events-none">
        
        {/* Left Column: Mission Briefing & Action Buttons */}
        <div className="max-w-xl flex flex-col gap-5 pointer-events-auto">
          {/* Mission Status Badge */}
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#F16938] animate-ping" />
            <div className="px-2.5 py-0.5 rounded-full bg-[#F16938]/15 border border-[#F16938]/30 flex items-center gap-2">
              <span className="text-[#F16938] font-mono text-[10px] sm:text-[11px] tracking-[0.25em] font-bold uppercase">
                ARES-V EXPEDITION // SOL {currentSol || 894}
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-md font-bold uppercase hidden sm:inline">
              SYSTEMS NOMINAL
            </span>
          </div>

          {/* Epic Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-display font-black tracking-tight leading-[1.04] drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-stone-50 via-stone-100 to-stone-300">
              EXPLORE THE RED
            </span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF7A50] via-[#F16938] to-[#E05220] drop-shadow-[0_0_24px_rgba(241,105,56,0.45)]">
              PLANET MARS
            </span>
          </h1>

          {/* Subtitle Description */}
          <p className="text-stone-300 font-sans text-sm sm:text-base leading-relaxed max-w-lg drop-shadow font-normal">
            Interactive Martian cartography, in-situ planetary science laboratory, and human EVA walkback traverse simulation. Built for NASA Space Apps 2026.
          </p>

          {/* Interactive CTAs */}
          <div className="flex items-center gap-3.5 flex-wrap pt-2">
            <button
              onClick={() => {
                marsAudio.playQuindarTone?.(true);
                setActiveTab('map');
              }}
              className="group px-6 py-3.5 rounded-full bg-gradient-to-r from-[#F16938] to-[#d64b19] hover:from-[#ff7a50] hover:to-[#F16938] text-white font-mono text-xs uppercase tracking-[0.14em] font-bold shadow-[0_0_25px_rgba(241,105,56,0.45)] active:scale-95 transition-all duration-300 flex items-center gap-2.5 cursor-pointer"
            >
              <Compass className="w-4 h-4 group-hover:rotate-45 transition-transform" />
              <span>Launch Mission Map</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => {
                marsAudio.playUiClick?.();
                setActiveTab('science');
              }}
              className="px-5 py-3.5 rounded-full bg-[#0A0D14]/85 hover:bg-[#121724]/95 text-stone-200 hover:text-white font-mono text-xs uppercase tracking-[0.12em] font-semibold border border-white/10 hover:border-[#00f0ff]/50 backdrop-blur-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Science Lab</span>
            </button>

            <button
              onClick={() => {
                marsAudio.playUiClick?.();
                setViewMode('3d');
                setActiveTab('map');
              }}
              className="px-4 py-3.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-stone-300 hover:text-white font-mono text-xs uppercase tracking-[0.12em] font-medium border border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
              title="Switch directly to 3D Globe Viewport"
            >
              <Globe className="w-4 h-4 text-amber-400" />
              <span>3D Globe</span>
            </button>
          </div>
        </div>

        {/* Bottom Interactive Strip: Active Hotspot Telemetry Card & Quick Switcher */}
        <div className="mt-8 pt-4 border-t border-white/[0.08] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pointer-events-auto">
          
          {/* Active Hotspot Inspector Card */}
          <div className="flex items-center gap-3.5 bg-[#0B0E17]/85 border border-white/10 rounded-2xl p-3 backdrop-blur-2xl shadow-xl max-w-md">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ backgroundColor: `${activeHotspot.color}15`, borderColor: `${activeHotspot.color}40`, color: activeHotspot.color }}
            >
              <MapPin className="w-5 h-5 animate-bounce" />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-xs uppercase tracking-wider text-white truncate">
                  {activeHotspot.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-bold bg-white/10 text-stone-300 shrink-0">
                  {activeHotspot.elev}
                </span>
              </div>
              <p className="text-[11px] font-mono text-stone-400 truncate">
                {activeHotspot.desc}
              </p>
            </div>

            <button
              onClick={() => handleLaunchToSpot(activeHotspot)}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] uppercase font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
              title="Fly directly to this landmark on the map"
            >
              <span>Explore</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Hotspot Quick Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest mr-1 shrink-0 hidden lg:inline">
              TARGETS:
            </span>
            {HERO_HOTSPOTS.map((spot) => (
              <button
                key={spot.id}
                onClick={() => handleSelectHotspot(spot)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-mono uppercase tracking-wider font-semibold transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
                  activeHotspot.id === spot.id
                    ? 'bg-[#F16938]/25 text-white border-[#F16938] shadow-[0_0_12px_rgba(241,105,56,0.3)]'
                    : 'bg-white/[0.02] text-stone-400 hover:text-white border-white/[0.06] hover:border-white/20'
                }`}
              >
                {spot.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Live Conditions Mini Readout */}
          <div className="flex items-center gap-3 font-mono text-[11px] text-stone-400 shrink-0 justify-end">
            <div className="flex items-center gap-1.5 text-cyan-300">
              <Thermometer className="w-3.5 h-3.5" />
              <span className="tabular-nums font-bold">{weather?.temperature?.avg || -63}°C</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-300">
              <RadioTower className="w-3.5 h-3.5" />
              <span className="tabular-nums font-bold">
                {typeof weather?.pressure === 'object' ? weather?.pressure?.value : (weather?.pressure || 610)} Pa
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-stone-300">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Delay: 14m 22s</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
