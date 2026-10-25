import { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import {  } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';

// The mascot bobs on one wall clock so the home speech bubble can follow the exact same motion.
const bobAt = (t) => ({ y: Math.sin(t * 2.6) * 0.12, x: Math.cos(t * 1.8) * 0.04 });
const PX_PER_UNIT = 37.7; // canvas is 120px tall and the camera sees ~3.18 world units at the bot's depth

// Lines the mascot cycles through on the home page
const QUOTES = ['Ask me anything…', 'Where should we walk today?', 'How much radiation at Jezero?', 'Can we get back before dark?'];

// 3D Cute Robot Mascot matching user reference (Named: EVA)
// `mouseRef.current` holds the normalised cursor position (0-1); read per frame so cursor moves don't re-render React
function MascotBot({ isHovered, mouseRef }) {
  const botGroupRef = useRef();
  const wavingArmRef = useRef();
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();

  // Materials matching reference: Clean white plastic, teal/cyan accents, and glossy blue screen
  const whiteMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.18,
    metalness: 0.08,
  }), []);

  const tealMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#06b6d4',
    roughness: 0.22,
    metalness: 0.1,
  }), []);

  const darkJointMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.4,
    metalness: 0.6,
  }), []);

  const screenMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0369a1',
    roughness: 0.08,
    metalness: 0.2,
    emissive: '#0284c7',
    emissiveIntensity: 0.4
  }), []);

  const eyeGlowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#38bdf8',
  }), []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Hover floating / levitation (hover korbe)
    if (botGroupRef.current) {
      const bob = bobAt(performance.now() / 1000);
      botGroupRef.current.position.y = bob.y;
      botGroupRef.current.position.x = bob.x;

      // Cursor tracking: Mascot playfully faces mouse cursor
      const targetRotX = (mouseRef.current.y - 0.5) * -0.45;
      const targetRotY = (mouseRef.current.x - 0.5) * 0.65;

      botGroupRef.current.rotation.x = THREE.MathUtils.lerp(botGroupRef.current.rotation.x, targetRotX, delta * 5);
      botGroupRef.current.rotation.y = THREE.MathUtils.lerp(botGroupRef.current.rotation.y, targetRotY, delta * 5);
      botGroupRef.current.rotation.z = Math.sin(t * 2.0) * 0.03;
    }

    // 2. Waving Right Hand (hat narbe)
    if (wavingArmRef.current) {
      const waveSpeed = isHovered ? 10.5 : 4.8;
      const waveAmplitude = isHovered ? 0.48 : 0.30;
      wavingArmRef.current.rotation.z = -0.55 + Math.sin(t * waveSpeed) * waveAmplitude;
      wavingArmRef.current.rotation.x = Math.cos(t * waveSpeed * 0.5) * 0.12;
    }

    // 3. Eye Blinking / Pulse animation
    const blinkCycle = Math.sin(t * 0.8);
    const isBlinking = blinkCycle > 0.96;
    if (leftEyeRef.current && rightEyeRef.current) {
      leftEyeRef.current.scale.y = isBlinking ? 0.1 : 1.0;
      rightEyeRef.current.scale.y = isBlinking ? 0.1 : 1.0;
    }
  });

  return (
    <group ref={botGroupRef} position={[0, 0, 0]} scale={[1.05, 1.05, 1.05]}>
      {/* Studio Lighting */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 5, 4]} intensity={1.8} color="#ffffff" />
      <pointLight position={[-3, -2, 3]} intensity={1.2} color="#38bdf8" />
      <pointLight position={[3, 1, 2]} intensity={1.4} color="#06b6d4" />

      {/* Head Group */}
      <group position={[0, 0.15, 0]}>
        {/* Head Outer Shell */}
        <mesh material={whiteMat} castShadow receiveShadow scale={[1.08, 0.98, 1.02]}>
          <sphereGeometry args={[0.62, 32, 32]} />
        </mesh>

        {/* Top Head Notch */}
        <mesh material={whiteMat} position={[0, 0.62, -0.05]} rotation={[-0.1, 0, 0]}>
          <boxGeometry args={[0.22, 0.14, 0.34]} />
        </mesh>

        {/* Left Ear-cup */}
        <group position={[-0.66, 0.05, -0.02]}>
          <mesh material={whiteMat} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.15, 20]} />
          </mesh>
          <mesh material={darkJointMat} position={[-0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <circleGeometry args={[0.09, 20]} />
          </mesh>
          <mesh material={tealMat} position={[-0.04, 0.28, 0]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[0.09, 0.34, 0.16]} />
          </mesh>
        </group>

        {/* Right Ear-cup */}
        <group position={[0.66, 0.05, -0.02]}>
          <mesh material={whiteMat} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.15, 20]} />
          </mesh>
          <mesh material={darkJointMat} position={[0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <circleGeometry args={[0.09, 20]} />
          </mesh>
          <mesh material={tealMat} position={[0.04, 0.28, 0]} rotation={[0, 0, 0.08]}>
            <boxGeometry args={[0.09, 0.34, 0.16]} />
          </mesh>
        </group>

        {/* Visor Screen */}
        <mesh material={screenMat} position={[0, 0.05, 0.34]} scale={[1.05, 0.88, 0.65]}>
          <sphereGeometry args={[0.48, 28, 28, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
        </mesh>

        {/* Happy Smiling Eyes (^ ^) */}
        <group ref={leftEyeRef} position={[-0.17, 0.10, 0.63]}>
          <mesh material={eyeGlowMat}>
            <torusGeometry args={[0.075, 0.022, 16, 20, Math.PI]} />
          </mesh>
        </group>

        <group ref={rightEyeRef} position={[0.17, 0.10, 0.63]}>
          <mesh material={eyeGlowMat}>
            <torusGeometry args={[0.075, 0.022, 16, 20, Math.PI]} />
          </mesh>
        </group>
      </group>

      {/* Torso Group */}
      <group position={[0, -0.52, -0.02]}>
        <mesh material={whiteMat} scale={[0.88, 0.95, 0.85]}>
          <sphereGeometry args={[0.48, 28, 28]} />
        </mesh>

        {/* Waist Seam */}
        <mesh material={darkJointMat} position={[0, -0.08, 0]} scale={[0.92, 0.03, 0.88]}>
          <torusGeometry args={[0.46, 0.03, 16, 32]} />
        </mesh>

        {/* Teal Chest Badge */}
        <mesh material={tealMat} position={[0, 0.08, 0.38]} scale={[0.26, 0.24, 0.08]}>
          <sphereGeometry args={[0.5, 20, 20]} />
        </mesh>

        {/* Left Arm */}
        <group position={[-0.48, 0.05, 0.05]} rotation={[0.2, 0, 0.45]}>
          <mesh material={whiteMat} position={[0, -0.22, 0]} scale={[0.14, 0.32, 0.15]}>
            <sphereGeometry args={[1, 16, 16]} />
          </mesh>
        </group>

        {/* Right Waving Arm (hat narbe) */}
        <group 
          ref={wavingArmRef} 
          position={[0.46, 0.12, 0.05]} 
          rotation={[0.1, 0, -0.55]}
        >
          <mesh material={whiteMat} position={[0.15, 0.22, 0]} rotation={[0, 0, -0.6]} scale={[0.15, 0.35, 0.16]}>
            <sphereGeometry args={[1, 16, 16]} />
          </mesh>
          <mesh material={whiteMat} position={[0.28, 0.42, 0.02]} scale={[0.16, 0.18, 0.12]}>
            <sphereGeometry args={[1, 16, 16]} />
          </mesh>
        </group>
      </group>

    </group>
  );
}

// EVA's Mascot Dialogues

export default function AresFloatingButton() {
  const isAresCopilotOpen = useMapStore(s => s.isAresCopilotOpen);
  const setAresCopilotOpen = useMapStore(s => s.setAresCopilotOpen);
  const large = useMapStore(s => s.homeHeroVisible);

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const bubbleRef = useRef(null);
  const dotRef = useRef(null);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Cycle the home quote
  useEffect(() => {
    if (!large) return undefined;
    setQuoteIndex(0);
    const id = setInterval(() => setQuoteIndex((i) => (i + 1) % QUOTES.length), 4200);
    return () => clearInterval(id);
  }, [large]);

  // Move the status dot and the home bubble with the mascot's bob, frame by frame
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf;
    const tick = () => {
      const { x, y } = bobAt(performance.now() / 1000);
      const transform = `translate(${(x * PX_PER_UNIT).toFixed(2)}px, ${(-y * PX_PER_UNIT).toFixed(2)}px)`;
      if (bubbleRef.current) bubbleRef.current.style.transform = transform;
      if (dotRef.current) dotRef.current.style.transform = transform;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Mouse & Touch coordinate tracking for the mascot head to follow the cursor / finger
  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = e.clientY / window.innerHeight;
    };
    const handleTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        mouseRef.current.x = e.touches[0].clientX / window.innerWidth;
        mouseRef.current.y = e.touches[0].clientY / window.innerHeight;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  if (isAresCopilotOpen) return null;

  return (
    <motion.div 
      drag
      dragMomentum={false}
      dragElastic={0.06}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        // Small delay so click event doesn't fire immediately upon drag release
        setTimeout(() => setIsDragging(false), 80);
      }}
      className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-[500] pointer-events-auto flex items-end gap-2 sm:gap-2.5 select-none cursor-grab active:cursor-grabbing touch-none"
    >
      {/* Short hint, only while hovering the mascot on pointer devices */}
      <AnimatePresence>
        {isHovered && !large && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
            className="hidden sm:block px-3 py-2 rounded-xl bg-[#090d16]/95 border border-cyan-400/40 text-sm text-white shadow-xl backdrop-blur-xl pointer-events-none"
          >
            Ask EVA to plan a route
          </motion.div>
        )}
      </AnimatePresence>

      {/* While the home hero is on screen the mascot speaks first */}
      <AnimatePresence>
        {large && (
          <motion.div
            key="home-quote"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.6 }}
            className="absolute bottom-full right-1 mb-1 max-w-[75vw] sm:max-w-none"
          >
            <button
              ref={bubbleRef}
              onClick={() => { marsAudio.playUiClick?.(); setAresCopilotOpen(true); }}
              className="relative block whitespace-normal sm:whitespace-nowrap rounded-2xl rounded-br-md bg-white text-slate-900 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium shadow-[0_10px_30px_rgba(0,0,0,0.45)] cursor-pointer will-change-transform"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={quoteIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="block"
                >
                  {QUOTES[quoteIndex]}
                </motion.span>
              </AnimatePresence>
              <span className="absolute -bottom-1.5 right-5 w-3 h-3 rotate-45 bg-white" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Interactive Mascot (Compact & Completely Draggable) */}
      <motion.div
        whileTap={{ scale: 0.94 }}
        onMouseEnter={() => {
          setIsHovered(true);
          marsAudio.playUiHover?.();
        }}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (isDragging) return;
          marsAudio.playUiClick?.();
          setAresCopilotOpen(true);
        }}
        className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center group"
      >
        {/* Soft Ambient Floating Shadow */}
        <div className="absolute -bottom-1 w-10 sm:w-12 h-2 sm:h-2.5 bg-cyan-500/20 blur-sm rounded-full pointer-events-none transition-all duration-300 group-hover:scale-125 group-hover:bg-cyan-400/35" />

        {/* 3D Canvas rendering the Robot Mascot freely floating */}
        {/* The canvas is 1.5x the hit area with the camera pulled back to match, so the waving arm is never clipped */}
        <div className="absolute left-1/2 top-1/2 w-[150%] h-[150%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <Canvas
            camera={{ position: [0, 0, 3.75], fov: 46 }}
            gl={{ alpha: true, antialias: true }}
            style={{ width: '100%', height: '100%', background: 'transparent' }}
            dpr={[1, 1.5]}
          >
            <Suspense fallback={null}>
              <MascotBot isHovered={isHovered} mouseRef={mouseRef} />
            </Suspense>
          </Canvas>
        </div>

        {/* Subtle Online Status Pill Badge */}
        <span ref={dotRef} className="absolute top-0.5 right-1 sm:top-1 sm:right-2 flex h-2 sm:h-2.5 w-2 sm:w-2.5 z-20 pointer-events-none will-change-transform">
          <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:h-2.5 bg-emerald-400 shadow-[0_0_6px_#34d399]" />
        </span>
      </motion.div>

    </motion.div>
  );
}
