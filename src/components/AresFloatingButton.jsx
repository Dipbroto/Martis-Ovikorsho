import { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import EvaProactiveAdvisor from './EvaProactiveAdvisor';
import useMapStore from '../store/useMapStore';
import { marsAudio } from '../utils/audioSynthesizer';

// Multi-harmonic hovering clock so external speech bubble tracks smoothly
const bobAt = (t) => ({
  y: Math.sin(t * 2.5) * 0.12 + Math.sin(t * 5.0) * 0.02,
  x: Math.cos(t * 1.8) * 0.04
});
const PX_PER_UNIT = 37.7;

// Home quotes loop
const QUOTES = [
  'Ask me anything…',
  'Where should we walk today?',
  'How much radiation at Jezero?',
  'Can we get back before dark?'
];

// 3D Cute Robot Mascot (Named: EVA) with Dynamic Facial Visor, Ion Thruster & Expressive Rig
function MascotBot({ isHovered, mouseRef, alertType = 'nominal', isSpeaking = false, spinTrigger = 0 }) {
  const botGroupRef = useRef();
  const headRef = useRef();
  const torsoRef = useRef();
  const wavingArmRef = useRef();
  const balancingArmRef = useRef();
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const thrusterRingRef = useRef();
  const ionConeRef = useRef();
  const leftBeaconRef = useRef();
  const rightBeaconRef = useRef();
  const voiceBarsRef = useRef([]);
  const spinStartTimeRef = useRef(0);

  // Emotional visual themes based on mission alert level
  const theme = useMemo(() => {
    if (alertType === 'critical') {
      return {
        teal: '#ff2d55',
        screen: '#4c0519',
        screenEmissive: '#e11d48',
        screenIntensity: 0.85,
        eye: '#ff3b30',
        thruster: '#ff2d55',
      };
    }
    if (alertType === 'warning') {
      return {
        teal: '#f59e0b',
        screen: '#451a03',
        screenEmissive: '#d97706',
        screenIntensity: 0.70,
        eye: '#fbbf24',
        thruster: '#f59e0b',
      };
    }
    return {
      teal: '#06b6d4',
      screen: '#0369a1',
      screenEmissive: '#0284c7',
      screenIntensity: 0.45,
      eye: '#38bdf8',
      thruster: '#22d3ee',
    };
  }, [alertType]);

  // Materials
  const whiteMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.18,
    metalness: 0.08,
  }), []);

  const darkJointMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.4,
    metalness: 0.6,
  }), []);

  const tealMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: theme.teal,
    roughness: 0.22,
    metalness: 0.1,
  }), [theme.teal]);

  const screenMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: theme.screen,
    roughness: 0.08,
    metalness: 0.2,
    emissive: theme.screenEmissive,
    emissiveIntensity: theme.screenIntensity,
  }), [theme.screen, theme.screenEmissive, theme.screenIntensity]);

  const eyeGlowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: theme.eye,
  }), [theme.eye]);

  const thrusterMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: theme.thruster,
    transparent: true,
    opacity: 0.85,
  }), [theme.thruster]);

  const leftBeaconMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#10b981', // Port green transponder
  }), []);

  const rightBeaconMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#38bdf8', // Starboard cyan transponder
  }), []);

  // Trigger playful jump-spin on tap/click
  useEffect(() => {
    if (spinTrigger > 0) {
      spinStartTimeRef.current = performance.now();
    }
  }, [spinTrigger]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Levitation & Hover Flight Dynamics (Anchor Face Firmly Forward)
    if (botGroupRef.current) {
      const bob = bobAt(performance.now() / 1000);
      let spinAngle = 0;
      let hopY = 0;

      // Playful jump-hop 360-spin
      if (spinStartTimeRef.current > 0) {
        const elapsed = (performance.now() - spinStartTimeRef.current) / 520;
        if (elapsed < 1) {
          // Smooth cosine ease-in-out: starts at 0, smoothly sweeps 360 degrees (2 * Math.PI)
          const eased = 0.5 - 0.5 * Math.cos(elapsed * Math.PI);
          spinAngle = eased * Math.PI * 2;
          hopY = Math.sin(elapsed * Math.PI) * 0.28;
        } else {
          spinStartTimeRef.current = 0;
          spinAngle = 0;
        }
      }

      // Base body position and forward alignment (0 at rest, spins full 360 and returns to 0)
      botGroupRef.current.position.y = bob.y + hopY;
      botGroupRef.current.position.x = bob.x;
      botGroupRef.current.rotation.x = 0;
      botGroupRef.current.rotation.y = spinAngle;
      botGroupRef.current.rotation.z = Math.sin(t * 2.0) * 0.035;
    }

    // 2. Independent Head Motion & Interactive Cursor Tracking (Clamped strictly to front hemisphere)
    if (headRef.current) {
      // Clamped to subtle, natural angles so face always stays facing forward toward the viewer
      const targetRotX = Math.max(-0.35, Math.min(0.25, (mouseRef.current.y - 0.5) * -0.45));
      const targetRotY = Math.max(-0.45, Math.min(0.45, (mouseRef.current.x - 0.5) * 0.55));

      // Conversational micro-nodding when speaking
      const speakNod = isSpeaking ? Math.sin(t * 8.0) * 0.03 : 0;
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetRotX + speakNod, delta * 6);
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetRotY, delta * 6);
      headRef.current.rotation.z = Math.sin(t * 1.8) * 0.03 + (alertType === 'warning' ? 0.05 : 0);
    }

    // 3. Torso Inertial Follow-Through (Stays forward-facing)
    if (torsoRef.current && headRef.current) {
      torsoRef.current.rotation.y = THREE.MathUtils.lerp(torsoRef.current.rotation.y, headRef.current.rotation.y * 0.35, delta * 3.5);
      torsoRef.current.rotation.x = THREE.MathUtils.lerp(torsoRef.current.rotation.x, headRef.current.rotation.x * 0.25, delta * 3.5);
      torsoRef.current.rotation.z = 0;
    }

    // 4. Dual Animated Arms (Waving Right Arm & Balancing Left Arm)
    if (wavingArmRef.current) {
      const waveSpeed = isHovered ? 12.0 : isSpeaking ? 7.5 : 4.5;
      const waveAmplitude = isHovered ? 0.55 : isSpeaking ? 0.40 : 0.28;
      wavingArmRef.current.rotation.z = -0.55 + Math.sin(t * waveSpeed) * waveAmplitude;
      wavingArmRef.current.rotation.x = Math.cos(t * waveSpeed * 0.5) * 0.14;
    }
    if (balancingArmRef.current) {
      balancingArmRef.current.rotation.z = 0.45 + Math.sin(t * 2.5 + 1.2) * 0.12;
      balancingArmRef.current.rotation.x = 0.20 + Math.cos(t * 2.5) * 0.08;
    }

    // 5. Dynamic Facial Eyes (Blinking & Joyous Expression)
    const blinkCycle = Math.sin(t * 0.85);
    const isBlinking = blinkCycle > 0.95;
    if (leftEyeRef.current && rightEyeRef.current) {
      const eyeScaleY = isBlinking ? 0.1 : (isHovered ? 1.25 : 1.0);
      leftEyeRef.current.scale.y = eyeScaleY;
      rightEyeRef.current.scale.y = eyeScaleY;
    }

    // 6. Speaking Voice Equalizer Bars on Visor
    if (voiceBarsRef.current) {
      voiceBarsRef.current.forEach((bar, idx) => {
        if (bar) {
          const h = isSpeaking ? (Math.abs(Math.sin(t * 14 + idx * 1.5)) * 0.8 + 0.25) : 0.15;
          bar.scale.y = h;
        }
      });
    }

    // 7. Anti-Gravity Plasma Thruster Pulse
    if (thrusterRingRef.current && ionConeRef.current) {
      const pulse = Math.sin(t * 9) * 0.15 + 0.9;
      thrusterRingRef.current.scale.set(pulse, pulse, pulse);
      ionConeRef.current.scale.set(pulse * 0.95, 0.75 + Math.sin(t * 14) * 0.3, pulse * 0.95);
    }

    // 8. Flight Navigation Beacons Blinking
    if (leftBeaconRef.current && rightBeaconRef.current) {
      const blink = Math.sin(t * 3.5) > 0.4 ? 1 : 0.25;
      leftBeaconRef.current.scale.setScalar(blink);
      rightBeaconRef.current.scale.setScalar(blink);
    }
  });

  return (
    <group ref={botGroupRef} position={[0, 0, 0]} scale={[1.05, 1.05, 1.05]}>
      {/* Studio Lighting */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 5, 4]} intensity={1.8} color="#ffffff" />
      <pointLight position={[-3, -2, 3]} intensity={1.2} color={theme.eye} />
      <pointLight position={[3, 1, 2]} intensity={1.4} color={theme.teal} />

      {/* Head Group (Independent Articulation) */}
      <group ref={headRef} position={[0, 0.15, 0]}>
        {/* Head Outer Shell */}
        <mesh material={whiteMat} castShadow receiveShadow scale={[1.08, 0.98, 1.02]}>
          <sphereGeometry args={[0.62, 32, 32]} />
        </mesh>

        {/* Top Head Antenna Notch */}
        <mesh material={whiteMat} position={[0, 0.62, -0.05]} rotation={[-0.1, 0, 0]}>
          <boxGeometry args={[0.22, 0.14, 0.34]} />
        </mesh>

        {/* Left Ear-cup Antenna & Navigation Light */}
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
          <mesh ref={leftBeaconRef} material={leftBeaconMat} position={[-0.04, 0.46, 0]}>
            <sphereGeometry args={[0.045, 12, 12]} />
          </mesh>
        </group>

        {/* Right Ear-cup Antenna & Navigation Light */}
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
          <mesh ref={rightBeaconRef} material={rightBeaconMat} position={[0.04, 0.46, 0]}>
            <sphereGeometry args={[0.045, 12, 12]} />
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

        {/* Animated Speaking Voice Waveform Bars on Visor */}
        <group position={[0, -0.07, 0.61]}>
          {[-0.08, -0.04, 0, 0.04, 0.08].map((x, i) => (
            <mesh
              key={i}
              ref={(el) => (voiceBarsRef.current[i] = el)}
              material={eyeGlowMat}
              position={[x, 0, 0]}
            >
              <boxGeometry args={[0.018, 0.06, 0.015]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Torso Group (Inertial Follow-Through) */}
      <group ref={torsoRef} position={[0, -0.52, -0.02]}>
        <mesh material={whiteMat} scale={[0.88, 0.95, 0.85]}>
          <sphereGeometry args={[0.48, 28, 28]} />
        </mesh>

        {/* Waist Seam */}
        <mesh material={darkJointMat} position={[0, -0.08, 0]} scale={[0.92, 0.03, 0.88]}>
          <torusGeometry args={[0.46, 0.03, 16, 32]} />
        </mesh>

        {/* Dynamic Chest Badge */}
        <mesh material={tealMat} position={[0, 0.08, 0.38]} scale={[0.26, 0.24, 0.08]}>
          <sphereGeometry args={[0.5, 20, 20]} />
        </mesh>

        {/* Left Balancing Arm */}
        <group ref={balancingArmRef} position={[-0.48, 0.05, 0.05]} rotation={[0.2, 0, 0.45]}>
          <mesh material={whiteMat} position={[-0.08, -0.20, 0]} scale={[0.14, 0.32, 0.15]}>
            <sphereGeometry args={[1, 16, 16]} />
          </mesh>
        </group>

        {/* Right Waving Arm */}
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

        {/* Anti-Gravity Plasma Thruster Nozzle & Glowing Exhaust */}
        <group position={[0, -0.44, 0]}>
          <mesh material={darkJointMat}>
            <cylinderGeometry args={[0.16, 0.20, 0.10, 24]} />
          </mesh>
          {/* Glowing Plasma Ring */}
          <mesh ref={thrusterRingRef} material={thrusterMat} position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.14, 0.032, 16, 28]} />
          </mesh>
          {/* Pulsing Ion Cone */}
          <mesh ref={ionConeRef} material={thrusterMat} position={[0, -0.16, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.12, 0.20, 20, 1, true]} />
          </mesh>
        </group>
      </group>

    </group>
  );
}

// EVA Floating Mascot & Autonomous Copilot Card
export default function AresFloatingButton() {
  const isAresCopilotOpen = useMapStore(s => s.isAresCopilotOpen);
  const setAresCopilotOpen = useMapStore(s => s.setAresCopilotOpen);
  const large = useMapStore(s => s.homeHeroVisible);
  const evaCallout = useMapStore(s => s.evaCallout);
  const dismissEvaCallout = useMapStore(s => s.dismissEvaCallout);

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [spinCount, setSpinCount] = useState(0);
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

  // Synchronize status dot and home bubble with bob frame by frame
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

  // Mouse & Touch coordinate tracking
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
        setTimeout(() => setIsDragging(false), 80);
      }}
      className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-[500] pointer-events-auto flex items-end gap-2 sm:gap-2.5 select-none cursor-grab active:cursor-grabbing touch-none"
    >
      {/* Short hover hint on pointer devices */}
      <AnimatePresence>
        {isHovered && !large && !evaCallout && (
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

      {/* Headless Proactive Observer Engine */}
      <EvaProactiveAdvisor />

      {/* Proactive Tactical Speech Bubble from Eva */}
      <AnimatePresence>
        {evaCallout ? (
          <motion.div
            key={evaCallout.id}
            initial={{ opacity: 0, y: 14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`absolute bottom-full right-0 mb-3 w-[88vw] max-w-sm sm:w-88 rounded-2xl p-3 sm:p-3.5 backdrop-blur-2xl shadow-2xl z-[510] pointer-events-auto touch-auto border ${
              evaCallout.type === 'critical'
                ? 'bg-[#150a10]/95 border-rose-500/80 shadow-[0_0_30px_rgba(244,63,94,0.35)]'
                : evaCallout.type === 'warning'
                  ? 'bg-[#120f0a]/95 border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
                  : 'bg-[#090e18]/95 border-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.3)]'
            }`}
          >
            {/* Top Header with Pulsing Co-Pilot Status and Dismiss Button */}
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    evaCallout.type === 'critical' ? 'bg-rose-400' : evaCallout.type === 'warning' ? 'bg-amber-400' : 'bg-cyan-400'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    evaCallout.type === 'critical' ? 'bg-rose-500' : evaCallout.type === 'warning' ? 'bg-amber-500' : 'bg-cyan-500'
                  }`} />
                </span>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-zinc-300">
                  EVA CO-PILOT
                </span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  evaCallout.type === 'critical'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : evaCallout.type === 'warning'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                }`}>
                  {evaCallout.type === 'critical' ? 'ALERT' : evaCallout.type === 'warning' ? 'ADVISORY' : 'INTEL'}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissEvaCallout();
                  marsAudio.playUiClick?.();
                }}
                className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/10 cursor-pointer transition-colors"
                title="Dismiss advisory"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Advisory Title and Text */}
            <div className="space-y-1">
              <div className={`text-xs font-bold leading-tight font-sans ${
                evaCallout.type === 'critical' ? 'text-rose-200' : evaCallout.type === 'warning' ? 'text-amber-200' : 'text-cyan-200'
              }`}>
                {evaCallout.title}
              </div>
              <p className="text-[11.5px] leading-relaxed text-zinc-300 font-sans">
                {evaCallout.text}
              </p>
            </div>

            {/* Action Buttons */}
            {(evaCallout.primaryAction || evaCallout.secondaryAction) && (
              <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center gap-1.5 justify-end">
                {evaCallout.secondaryAction && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      evaCallout.secondaryAction.action();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer border border-white/10"
                  >
                    {evaCallout.secondaryAction.label}
                  </button>
                )}
                {evaCallout.primaryAction && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      evaCallout.primaryAction.action();
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold font-mono uppercase tracking-wider transition-all cursor-pointer shadow-md ${
                      evaCallout.type === 'critical'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_2px_10px_rgba(244,63,94,0.4)]'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_2px_10px_rgba(6,182,212,0.4)]'
                    }`}
                  >
                    {evaCallout.primaryAction.label}
                  </button>
                )}
              </div>
            )}

            {/* Speech Bubble Tail */}
            <span className={`absolute -bottom-1.5 right-6 w-3 h-3 rotate-45 border-r border-b ${
              evaCallout.type === 'critical'
                ? 'bg-[#150a10] border-rose-500/80'
                : evaCallout.type === 'warning'
                  ? 'bg-[#120f0a] border-amber-500/80'
                  : 'bg-[#090e18] border-cyan-400/80'
            }`} aria-hidden="true" />
          </motion.div>
        ) : large ? (
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
        ) : null}
      </AnimatePresence>

      {/* 3D Interactive Mascot (Compact & Completely Draggable) */}
      <motion.div
        whileTap={{ scale: 0.92 }}
        onMouseEnter={() => {
          setIsHovered(true);
          marsAudio.playUiHover?.();
        }}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (isDragging) return;
          setSpinCount((c) => c + 1);
          marsAudio.playUiClick?.();
          setTimeout(() => {
            setAresCopilotOpen(true);
          }, 480);
        }}
        className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center group"
      >
        {/* Soft Ambient Floating Shadow pulsing with ion thruster */}
        <div className={`absolute -bottom-1 w-10 sm:w-12 h-2 sm:h-2.5 blur-sm rounded-full pointer-events-none transition-all duration-300 group-hover:scale-125 ${
          evaCallout?.type === 'critical'
            ? 'bg-rose-500/40 shadow-[0_0_16px_rgba(244,63,94,0.6)] animate-pulse'
            : evaCallout?.type === 'warning'
              ? 'bg-amber-500/35 shadow-[0_0_14px_rgba(245,158,11,0.5)]'
              : 'bg-cyan-500/25 shadow-[0_0_12px_rgba(6,182,212,0.4)] group-hover:bg-cyan-400/40'
        }`} />

        {/* 3D Canvas rendering the Robot Mascot freely floating */}
        <div className="absolute left-1/2 top-1/2 w-[150%] h-[150%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <Canvas
            camera={{ position: [0, 0, 3.75], fov: 46 }}
            gl={{ alpha: true, antialias: true }}
            style={{ width: '100%', height: '100%', background: 'transparent' }}
            dpr={[1, 1.5]}
          >
            <Suspense fallback={null}>
              <MascotBot
                isHovered={isHovered}
                mouseRef={mouseRef}
                alertType={evaCallout?.type || 'nominal'}
                isSpeaking={Boolean(evaCallout)}
                spinTrigger={spinCount}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* Dynamic Online / Alert Status Pill Badge */}
        <span ref={dotRef} className="absolute top-0.5 right-1 sm:top-1 sm:right-2 flex h-2 sm:h-2.5 w-2 sm:w-2.5 z-20 pointer-events-none will-change-transform">
          <span className={`relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 ${
            evaCallout?.type === 'critical'
              ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-ping'
              : evaCallout?.type === 'warning'
                ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                : 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
          }`} />
        </span>
      </motion.div>

    </motion.div>
  );
}
