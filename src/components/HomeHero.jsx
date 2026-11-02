import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Compass, ChevronDown, FlaskConical, Sparkles, ShieldAlert, Image as ImageIcon } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import useMapStore from '../store/useMapStore';
import { lsFromMsd, seasonFromLs } from '../utils/marsSolar';
import { AUTONOMOUS_TARGET_PAIRS } from '../utils/autonomousRouter';
import Logo from './Logo';
import StatsBand from './home/StatsBand';
import TerrainDemo from './home/TerrainDemo';
import SurvivalAtlas from './home/SurvivalAtlas';
import SiteCard from './home/SiteCard';

const EXTRAS = [
  { key: 'science', title: 'Science Lab', desc: 'Analyse curated NASA rock targets', icon: FlaskConical, tint: 'from-sky-500/20' },
  { key: 'sky', title: 'Sky Watch', desc: 'Phobos, Deimos and the Sun overhead', icon: Sparkles, tint: 'from-violet-500/20' },
  { key: 'contingency', title: 'Contingency Drills', desc: 'Practise dust storms and O₂ faults', icon: ShieldAlert, tint: 'from-amber-500/20' },
  { key: 'imagery', title: 'Image Gallery', desc: 'NASA imagery of Mars', icon: ImageIcon, tint: 'from-emerald-500/20' },
];

/**
 * Scrolls the home page's own container to a section. It moves the container itself (never the browser
 * window or its parents), re-measures the target on every frame so content that loads in and shifts the
 * layout cannot throw it off, and finishes exactly on the section.
 */
function scrollToSection(container, id, { duration = 750, offset = 12 } = {}) {
  if (!container) return;
  const targetTop = () => {
    const el = document.getElementById(id);
    if (!el) return Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + container.clientHeight * 0.9);
    return Math.max(0, el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - offset);
  };
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { container.scrollTop = targetTop(); return; }
  const run = (container.__scrollRun = (container.__scrollRun || 0) + 1); // a newer click takes over from an older one
  const from = container.scrollTop;
  const t0 = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  let last = from;
  const frame = (now) => {
    if (container.__scrollRun !== run) return;
    // someone scrolled by hand while it was moving: leave them in control
    if (Math.abs(container.scrollTop - last) > 3 && now - t0 > 50) return;
    const k = Math.min(1, (now - t0) / duration);
    const to = from + (targetTop() - from) * ease(k);
    container.scrollTop = to;
    last = container.scrollTop;
    if (k < 1) requestAnimationFrame(frame);
    else container.scrollTop = targetTop();
  };
  requestAnimationFrame(frame);
}

const fade = { initial: { opacity: 0, y: 14 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.4 } };

/** Coordinated Mars Time (the Martian equivalent of UTC) as hh:mm:ss. */
function marsTimeNow() {
  const jdTT = Date.now() / 86400000 + 2440587.5 + 69.184 / 86400;
  const msd = (jdTT - 2405522.0028779) / 1.0274912517;
  const s = Math.floor(((msd % 1) + 1) % 1 * 86400);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function HomeHero({ onSelectTab }) {
  const currentSol = useMapStore((s) => s.currentSol);
  const weather = useMapStore((s) => s.weather);
  const setGuidedPlannerOpen = useMapStore((s) => s.setGuidedPlannerOpen);
  const setHomeHeroVisible = useMapStore((s) => s.setHomeHeroVisible);
  const ls = lsFromMsd(currentSol);
  const [mtc, setMtc] = useState(marsTimeNow);

  useEffect(() => {
    const t = setInterval(() => setMtc(marsTimeNow()), 1000);
    return () => clearInterval(t);
  }, []);

  // The home page scrolls inside its own container, not the window
  const scrollRef = useRef(null);
  const heroRef = useRef(null);

  // Tell the EVA mascot whether the hero is on screen so it can grow here and shrink everywhere else
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => setHomeHeroVisible(entry.intersectionRatio > 0.45), { root: scrollRef.current, threshold: [0, 0.45, 1] });
    io.observe(el);
    return () => { io.disconnect(); setHomeHeroVisible(false); };
  }, [setHomeHeroVisible]);
  // How far the hero has scrolled away, 0 to 1. Measured here because this page is display:none on the other tabs:
  // framer's useScroll measures a zero-sized hero there and keeps that, which leaves the hero text at opacity 0.
  const scrollYProgress = useMotionValue(0);
  useEffect(() => {
    const container = scrollRef.current;
    const hero = heroRef.current;
    if (!container || !hero) return undefined;
    const measure = () => {
      if (hero.offsetHeight) scrollYProgress.set(Math.min(1, Math.max(0, container.scrollTop / hero.offsetHeight)));
    };
    measure();
    container.addEventListener('scroll', measure, { passive: true });
    const ro = window.ResizeObserver ? new ResizeObserver(measure) : null;
    ro?.observe(container);
    return () => {
      container.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, [scrollYProgress]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.04, 1.18]);
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '12%']);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const contentOpacity = useTransform(scrollYProgress, [0.35, 0.9], [1, 0]);

  return (
    <div ref={scrollRef} className="relative w-full h-screen overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#05070b] text-white selection:bg-[#f16938]/30">
      {/* HERO */}
      <section ref={heroRef} className="relative w-full min-h-[100svh] flex flex-col justify-end overflow-hidden">
        <motion.div className="absolute inset-0 bg-cover bg-center will-change-transform" style={{ backgroundImage: "url('/mars_base_sunset.jpg')", scale: bgScale, y: bgY }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070b] via-[#05070b]/50 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent" />

        <motion.div style={{ y: contentY, opacity: contentOpacity }} className="relative z-10 max-w-[1500px] w-full mx-auto px-5 sm:px-10 pt-32 pb-24 lg:pb-16 grid lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 backdrop-blur px-3 py-1.5 text-sm text-zinc-200 mb-6">
              <Logo className="w-4 h-4" />NASA Space Apps 2026 · Interplanetary Survival Guide
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }} className="text-[2.6rem] sm:text-6xl lg:text-[3.6rem] xl:text-[4.2rem] xl:w-[140%] font-bold tracking-tight leading-[1.04] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
              Understand Martian Terrain.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#ffb08f] to-[#F26A3D]">Outsmart the Unknown.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16 }} className="mt-6 text-lg sm:text-xl text-zinc-200 max-w-2xl leading-relaxed">
              Explore real NASA terrain and plan how to survive it: how far your life support takes you, where the water and shelter are, how much radiation you take, and what to do when something goes wrong.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24 }} className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={() => setGuidedPlannerOpen(true)} className="group flex items-center gap-2 bg-white hover:bg-zinc-100 text-black px-6 py-3.5 rounded-xl text-base font-semibold transition-all active:scale-95 cursor-pointer shadow-[0_10px_40px_-10px_rgba(255,255,255,0.5)]">
                <Compass className="w-5 h-5 transition-transform group-hover:rotate-45" />Plan a Marswalk
              </button>
              <button onClick={() => onSelectTab?.('map')} className="group flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 px-5 py-3.5 rounded-xl text-base font-medium backdrop-blur transition-all cursor-pointer">
                Open the map<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </motion.div>
          </div>

          {/* Mars right now */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="lg:col-span-4 lg:mb-28 lg:max-w-md lg:ml-auto">
            <div className="rounded-2xl p-5 bg-white/[0.04] backdrop-blur-md border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-2 text-xs text-zinc-200"><span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" /><span className="relative w-2 h-2 rounded-full bg-emerald-400" /></span>Mars right now</span>
                <span className="text-xs text-zinc-300">Sol {currentSol}</span>
              </div>
              <div className="text-xs text-zinc-300">Coordinated Mars Time</div>
              <div className="text-4xl font-semibold tabular-nums tracking-tight font-mono drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">{mtc}</div>
              <dl className="mt-4 pt-4 border-t border-white/15 grid grid-cols-3 gap-3">
                <div><dt className="text-xs text-zinc-300">Season</dt><dd className="font-semibold text-emerald-300 leading-tight">{seasonFromLs(ls)}</dd><dd className="text-xs text-zinc-300">Ls {ls.toFixed(0)}°</dd></div>
                <div><dt className="text-xs text-zinc-300">Temp <span className="text-zinc-400">(model)</span></dt><dd className="font-semibold tabular-nums">{weather?.temperature?.avg ?? '--'} °C</dd></div>
                <div><dt className="text-xs text-zinc-300">Pressure <span className="text-zinc-400">(model)</span></dt><dd className="font-semibold tabular-nums">{weather?.pressure?.value ?? '--'} Pa</dd></div>
              </dl>
            </div>
          </motion.div>
        </motion.div>

        <button
          onClick={() => scrollToSection(scrollRef.current, 'how-it-works')}
          aria-label="Scroll down to try it"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 px-4 py-2 text-xs text-zinc-300 hover:text-white cursor-pointer"
        >
          Try it below
          <motion.span animate={{ y: [0, 5, 0] }} transition={{ duration: 1.6, repeat: Infinity }}><ChevronDown className="w-4 h-4" /></motion.span>
        </button>
      </section>

      <StatsBand />

      {/* Interactive how-it-works */}
      <TerrainDemo />

      {/* Survive and explore: the whole planet */}
      <SurvivalAtlas />

      {/* START SOMEWHERE */}
      <section className="border-t border-white/[0.07] bg-[#04060a]">
        <div className="max-w-[1500px] mx-auto px-5 sm:px-10 py-20 sm:py-24">
          <motion.div {...fade} className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-[#ffa07f] font-medium mb-2">Start somewhere</p>
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">Pick a walk. We plan it.</h2>
              <p className="mt-3 text-zinc-300 max-w-2xl text-lg">Each starts at a real landing site or base. The previews are the actual terrain the planner walks on.</p>
            </div>
          </motion.div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {AUTONOMOUS_TARGET_PAIRS.map((p, i) => (
              <SiteCard key={p.id} pair={p} index={i} onOpen={() => setGuidedPlannerOpen(true, p.id)} />
            ))}
          </div>
        </div>
      </section>

      {/* EXTRAS */}
      <section className="border-t border-white/[0.07]">
        <div className="max-w-[1500px] mx-auto px-5 sm:px-10 py-16 sm:py-20">
          <motion.h2 {...fade} className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">More to explore</motion.h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {EXTRAS.map(({ key, title, desc, icon: Icon, tint }, i) => (
              <motion.button
                key={key}
                {...fade}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                whileHover={{ y: -4 }}
                onClick={() => onSelectTab?.(key)}
                className={`group relative overflow-hidden text-left rounded-2xl border border-white/10 hover:border-white/25 bg-gradient-to-br ${tint} to-transparent p-5 cursor-pointer`}
              >
                <span className="w-11 h-11 rounded-xl bg-white/[0.08] flex items-center justify-center mb-6 transition-transform group-hover:scale-110"><Icon className="w-5 h-5 text-white" /></span>
                <span className="block text-lg font-semibold">{title}</span>
                <span className="block text-sm text-zinc-400 mt-1">{desc}</span>
                <ArrowRight className="absolute top-5 right-5 w-4 h-4 text-zinc-500 transition-all group-hover:text-white group-hover:translate-x-1" />
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="max-w-[1500px] mx-auto px-5 sm:px-10 pb-16">
        <motion.div {...fade} className="relative overflow-hidden rounded-3xl border border-white/10">
          <div className="absolute inset-0 bg-cover bg-[center_70%]" style={{ backgroundImage: "url('/mars_base_sunset.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#05070b] via-[#05070b]/85 to-[#05070b]/40" />
          <div className="relative p-8 sm:p-14 flex flex-wrap items-center justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">Ready to step outside?</h2>
              <p className="mt-3 text-lg text-zinc-300">Choose a site and a goal. MarsWalk does the rest, and shows you its working.</p>
            </div>
            <button onClick={() => setGuidedPlannerOpen(true)} className="group flex items-center gap-2 bg-[#F26A3D] hover:bg-[#ff7b4d] text-white px-7 py-4 rounded-xl text-lg font-semibold transition-all active:scale-95 cursor-pointer shadow-[0_20px_50px_-15px_rgba(242,106,61,0.7)]">
              <Compass className="w-5 h-5 transition-transform group-hover:rotate-45" />Plan a Marswalk
            </button>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.07]">
        <div className="max-w-[1500px] mx-auto px-5 sm:px-10 py-10 flex flex-wrap items-start justify-between gap-6">
          <div className="group flex items-center gap-2.5">
            <Logo className="w-6 h-6" />
            <span className="font-display font-bold tracking-[0.12em] uppercase">MarsWalk</span>
          </div>
          <p className="text-sm text-zinc-500 max-w-3xl leading-relaxed">
            Built for the NASA Space Apps Challenge 2026. Terrain, water, cave and rover data come from NASA, USGS and the Planetary Data System. Weather, radiation and the science lab are simulations and are labelled as such.
          </p>
        </div>
      </footer>
    </div>
  );
}
