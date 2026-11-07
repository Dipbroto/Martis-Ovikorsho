import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Sun, Moon, Globe2, Clock, Radio, Eclipse, Info, Telescope, Search, Loader2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, CartesianGrid } from 'recharts';
import { playUiClick } from '../utils/audioSynthesizer';
import TransitViewer from './sky/TransitViewer';
import RoverAstrophotography from './sky/RoverAstrophotography';
import { skyAt, solTimeline, nextTransitSol, starsAndPlanets } from '../utils/marsSky';
import { lsFromMsd, seasonFromLs, MARS_SOL_HOURS, localTrueSolarTime, msdFromLocalSolarTime } from '../utils/marsSolar';

const SITES = [
  { id: 'jezero', name: 'Jezero Crater', sub: 'Perseverance', lat: 18.44, lon: 77.45 },
  { id: 'gale', name: 'Gale Crater', sub: 'Curiosity', lat: -4.59, lon: 137.44 },
  { id: 'elysium', name: 'Elysium Planitia', sub: 'InSight', lat: 4.5, lon: 135.62 },
  { id: 'olympus', name: 'Olympus Mons', sub: 'Summit caldera', lat: 18.65, lon: -133.8 },
  { id: 'arcadia', name: 'Arcadia Planitia', sub: 'Ice-rich plains', lat: 39.1, lon: -171.45 },
  { id: 'pole', name: 'North polar cap', sub: 'Planum Boreum', lat: 75, lon: 0 },
];

const BODIES = {
  sun: { name: 'Sun', color: '#fbbf24', icon: Sun },
  phobos: { name: 'Phobos', color: '#e7e5e4', icon: Moon },
  deimos: { name: 'Deimos', color: '#67e8f9', icon: Moon },
  earth: { name: 'Earth', color: '#60a5fa', icon: Globe2 },
};

// A rover photo's mission sol is counted in local sols from landing; adding these gives the local sol on the
// MSD scale the sky uses (Curiosity landed on local MSD 49269, Perseverance on 52304)
const MISSION_SOL0 = { 'Curiosity (MSL)': 49269, 'Perseverance (M2020)': 52304 };
const fmt = (h) => {
  const x = ((h % 24) + 24) % 24;
  const m = Math.round(x * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const compass = (az) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(az / 45) % 8];
const tooltipStyle = { backgroundColor: 'rgba(7,9,14,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 };

// Faint background stars: random but fixed positions on the celestial sphere, so they turn with the real sky
const FAINT_STARS = (() => {
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return Array.from({ length: 260 }, () => [r() * 360, (Math.asin(2 * r() - 1) * 180) / Math.PI, 2.5 + r() * 2.5]);
})();


function Panel({ title, icon: Icon, right, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#070a12]/70 backdrop-blur-xl p-5 sm:p-6 ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">{Icon && <Icon className="w-4 h-4 text-[#ffa07f]" />}{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const PLANET_COLORS = { Mercury: '#d6d3d1', Venus: '#fef3c7', Jupiter: '#fde7c2', Saturn: '#f5deb3' };

/**
 * Looking straight up: north at the top, east on the LEFT (as on any sky chart).
 * Hover anything to identify it; drag sideways to move time and watch the sky turn.
 */
function SkyDome({ sky, objects, timeline, selected, onSelect, onDragTime }) {
  const S = 360, C = S / 2, R = C - 22;
  const proj = (alt, az) => {
    const r = ((90 - alt) / 90) * R;
    const a = (az * Math.PI) / 180;
    return [C - r * Math.sin(a), C - r * Math.cos(a)];
  };
  const unproj = (x, y) => {
    const dx = C - x, dy = C - y;
    const r = Math.hypot(dx, dy);
    return { alt: 90 - (r / R) * 90, az: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360, inside: r <= R };
  };
  const sunAlt = sky.sun.alt;
  const night = Math.max(0, Math.min(1, (-sunAlt - 2) / 12)); // 0 day .. 1 full night
  const twilight = Math.max(0, 1 - Math.abs(sunAlt - 2) / 10);
  const [sx, sy] = proj(Math.max(sunAlt, -10), sky.sun.az);

  const paths = useMemo(() => {
    const out = {};
    for (const key of Object.keys(BODIES)) {
      const segs = [];
      let cur = [];
      for (const p of timeline.samples) {
        if (p[key] > 0) cur.push(proj(p[key], p.az[key]).map((v) => v.toFixed(1)).join(','));
        else if (cur.length) { segs.push(cur); cur = []; }
      }
      if (cur.length) segs.push(cur);
      out[key] = segs.filter((sg) => sg.length > 1);
    }
    return out;
    // proj only depends on constants
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);

  // What can actually be seen: the bright stars and planets come out in twilight, faint ones only at night
  const visibleObjects = objects.filter((o) => o.alt > 0 && (o.kind === 'faint' ? night > 0.3 : o.mag < 1 ? night > 0.05 : night > 0.2));

  // Everything you can point at, in screen coordinates
  const targets = useMemo(() => {
    const list = [];
    for (const key of ['sun', 'phobos', 'deimos', 'earth']) {
      const b = sky[key];
      if (b.alt > 0) list.push({ id: key, name: BODIES[key].name, kind: key === 'sun' ? 'Star' : key === 'earth' ? 'Planet' : 'Moon of Mars', b, xy: proj(b.alt, b.az) });
    }
    for (const o of visibleObjects) if (o.name) list.push({ id: o.name, name: o.name, kind: o.kind === 'planet' ? 'Planet' : 'Star', b: o, xy: proj(o.alt, o.az) });
    return list;
    // proj only depends on constants
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sky, visibleObjects]);

  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // { x, y, alt, az, target }
  const dragRef = useRef(null);

  const local = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * S, y: ((e.clientY - r.top) / r.height) * S, scale: r.width / S };
  };
  const nearest = (x, y) => {
    let best = null;
    for (const t of targets) {
      const d = Math.hypot(t.xy[0] - x, t.xy[1] - y);
      if (d < 16 && (!best || d < best.d)) best = { ...t, d };
    }
    return best;
  };
  const onMove = (e) => {
    const { x, y } = local(e);
    if (dragRef.current) {
      const dx = x - dragRef.current.x;
      if (Math.abs(dx) > 3) dragRef.current.moved = true;
      if (dragRef.current.moved) {
        onDragTime((dx / S) * 6); // a full sweep across the dome is 6 hours
        dragRef.current.x = x;
      }
    }
    const pos = unproj(x, y);
    setHover(pos.inside ? { x, y, alt: pos.alt, az: pos.az, target: nearest(x, y) } : null);
  };

  const dayTop = `rgba(196, 140, 84, ${0.85 * (1 - night)})`;
  const label = (key) => (key === 'Sirius' || key === 'Canopus' || key === 'Vega' || key === 'Deneb' || key === 'Arcturus');

  return (
    <div className="relative max-w-[440px] mx-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${S} ${S}`}
        className="w-full block touch-none cursor-grab active:cursor-grabbing select-none"
        role="img"
        aria-label="The sky overhead from the selected site. Drag sideways to move time."
        onPointerDown={(e) => { dragRef.current = { x: local(e).x, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={onMove}
        onPointerUp={(e) => {
          const wasDrag = dragRef.current?.moved;
          dragRef.current = null;
          if (!wasDrag) { const { x, y } = local(e); const t = nearest(x, y); if (t && BODIES[t.id]) onSelect(t.id); }
        }}
        onPointerLeave={() => { if (!dragRef.current) setHover(null); }}
      >
        <defs>
          <radialGradient id="domeSky" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={night > 0.5 ? '#070b18' : '#7a4a26'} stopOpacity={1} />
            <stop offset="100%" stopColor={night > 0.5 ? '#02030a' : '#2a160b'} stopOpacity={1} />
          </radialGradient>
          {/* Mars's sky is blue-white close to the Sun all day (forward-scattering dust), strongest at twilight */}
          <radialGradient id="sunGlow" cx={sx / S} cy={sy / S} r={0.18 + 0.27 * twilight} gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity={Math.max(0.55 * (1 - night), 0.8 * twilight)} />
            <stop offset="45%" stopColor="#7dd3fc" stopOpacity={Math.max(0.18 * (1 - night), 0.3 * twilight)} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
          </radialGradient>
          {/* Dusty haze thickens towards the horizon */}
          <radialGradient id="horizonHaze" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#d6a679" stopOpacity={0} />
            <stop offset="100%" stopColor="#d6a679" stopOpacity={0.45 * (1 - night)} />
          </radialGradient>
          <clipPath id="domeClip"><circle cx={C} cy={C} r={R} /></clipPath>
        </defs>
        <circle cx={C} cy={C} r={R} fill="url(#domeSky)" />
        <g clipPath="url(#domeClip)">
          <circle cx={C} cy={C} r={R} fill={dayTop} opacity={0.6} />
          <circle cx={C} cy={C} r={R} fill="url(#horizonHaze)" />
          <rect width={S} height={S} fill="url(#sunGlow)" />
          {/* Stars and planets */}
          {visibleObjects.map((o, i) => {
            const [x, y] = proj(o.alt, o.az);
            const size = Math.max(0.5, 2.6 - o.mag * 0.55);
            const fade = o.kind === 'faint' ? night * 0.7 : Math.min(1, night * 3);
            if (o.kind === 'planet') {
              return (
                <g key={`p-${o.name}`} opacity={fade}>
                  <circle cx={x} cy={y} r={size + 3} fill={PLANET_COLORS[o.name]} opacity="0.18" />
                  <circle cx={x} cy={y} r={size} fill={PLANET_COLORS[o.name]} />
                  <text x={x + 6} y={y - 5} fill="#fde68a" fontSize="10" fontWeight="600" style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.75)" strokeWidth="3">{o.name}</text>
                </g>
              );
            }
            return (
              <g key={`s-${o.name || i}`} opacity={fade}>
                <circle cx={x} cy={y} r={o.kind === 'faint' ? 0.4 + (5 - o.mag) * 0.25 : size} fill="#fff" />
                {o.kind === 'star' && label(o.name) && <text x={x + 5} y={y - 4} fill="rgba(255,255,255,0.7)" fontSize="9">{o.name}</text>}
              </g>
            );
          })}
          {[30, 60].map((alt) => <circle key={alt} cx={C} cy={C} r={((90 - alt) / 90) * R} fill="none" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 5" />)}
          <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="rgba(255,255,255,0.08)" />
          <line x1={C - R} y1={C} x2={C + R} y2={C} stroke="rgba(255,255,255,0.08)" />
          {Object.entries(paths).map(([key, segs]) => segs.map((sg, i) => (
            <polyline key={`${key}-${i}`} points={sg.join(' ')} fill="none" stroke={BODIES[key].color} strokeOpacity={selected === key ? 0.7 : 0.22} strokeWidth={selected === key ? 1.6 : 1} strokeDasharray={key === 'sun' ? undefined : '2 4'} />
          )))}
          {/* Pointer crosshair */}
          {hover && !hover.target && (
            <g opacity="0.6" pointerEvents="none">
              <circle cx={C} cy={C} r={((90 - hover.alt) / 90) * R} fill="none" stroke="#fff" strokeOpacity="0.35" strokeDasharray="2 3" />
              <line x1={C} y1={C} x2={hover.x} y2={hover.y} stroke="#fff" strokeOpacity="0.35" strokeDasharray="2 3" />
              <circle cx={hover.x} cy={hover.y} r="3" fill="none" stroke="#fff" />
            </g>
          )}
        </g>
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.25)" />
        {[['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([l, az]) => {
          const [x, y] = proj(-9, az);
          return <text key={l} x={x} y={y} fill="#a1a1aa" fontSize="12" textAnchor="middle" dominantBaseline="middle">{l}</text>;
        })}
        <text x={C + 4} y={C - ((60 / 90) * R) + 12} fill="rgba(255,255,255,0.35)" fontSize="9">30°</text>
        <text x={C + 4} y={C - ((30 / 90) * R) + 12} fill="rgba(255,255,255,0.35)" fontSize="9">60°</text>

        {/* Sun, moons and Earth; labels step down when two are close (e.g. Phobos crossing the Sun) */}
        {(() => {
          const placed = [];
          return ['sun', 'phobos', 'earth', 'deimos'].map((key) => {
            const b = sky[key];
            if (b.alt <= 0) return null;
            const [x, y] = proj(b.alt, b.az);
            let dy = -9;
            while (placed.some((q) => Math.abs(q.x - x) < 60 && Math.abs(q.y - (y + dy)) < 13)) dy += 14;
            placed.push({ x, y: y + dy });
            return { key, b, x, y, dy };
          });
        })().filter(Boolean).reverse().map(({ key, b, x, y, dy }) => {
          const on = selected === key || hover?.target?.id === key;
          return (
            <g key={key} transform={`translate(${x} ${y})`} className="cursor-pointer">
              {key === 'sun' && <><circle r="16" fill="#fde68a" opacity="0.25" /><circle r="8" fill="#fffbeb" /></>}
              {key === 'phobos' && <ellipse rx="6" ry="4.6" transform="rotate(-20)" fill={b.eclipsed ? '#7f1d1d' : `rgba(231,229,228,${0.35 + 0.65 * b.illumination})`} stroke="#fff" strokeOpacity="0.4" />}
              {key === 'deimos' && <circle r="3.2" fill={`rgba(165,243,252,${0.4 + 0.6 * b.illumination})`} />}
              {key === 'earth' && <><circle r="7" fill="#3b82f6" opacity="0.25" /><circle r="3.2" fill="#93c5fd" /></>}
              {on && <circle r={key === 'sun' ? 14 : 11} fill="none" stroke="#fff" strokeWidth="1.5" />}
              <text x="11" y={dy} fill="#fff" fontSize="11" fontWeight="600" style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.7)" strokeWidth="3">{BODIES[key].name}</text>
            </g>
          );
        })}
        {hover?.target && !BODIES[hover.target.id] && (
          <circle cx={hover.target.xy[0]} cy={hover.target.xy[1]} r="8" fill="none" stroke="#fff" strokeWidth="1.2" pointerEvents="none" />
        )}
      </svg>

      {/* Hover card */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-white/15 bg-black/85 backdrop-blur px-2.5 py-1.5 text-xs text-white shadow-xl whitespace-nowrap"
          style={{ left: `${(hover.x / S) * 100}%`, top: `${(hover.y / S) * 100}%`, transform: `translate(${hover.x > C ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}
        >
          {hover.target ? (
            <>
              <div className="font-semibold">{hover.target.name} <span className="text-zinc-400 font-normal">· {hover.target.kind}</span></div>
              <div className="text-zinc-300 tabular-nums">{Math.round(hover.target.b.alt)}° up · {Math.round(hover.target.b.az)}° {compass(hover.target.b.az)}</div>
              {hover.target.b.distAu != null && <div className="text-zinc-400 tabular-nums">{hover.target.b.distAu.toFixed(2)} AU from Mars</div>}
              {hover.target.b.distKm != null && <div className="text-zinc-400 tabular-nums">{Math.round(hover.target.b.distKm).toLocaleString()} km away</div>}
              {hover.target.b.mag != null && <div className="text-zinc-400">Brightness: magnitude {hover.target.b.mag.toFixed(1)}</div>}
            </>
          ) : (
            <div className="tabular-nums">{Math.round(hover.alt)}° up · {Math.round(hover.az)}° {compass(hover.az)}</div>
          )}
        </div>
      )}
    </div>
  );
}

function MartianSkyEphemeris() {
  const [site, setSite] = useState(() => SITES.find((x) => x.id === 'gale'));
  // Local sol and local TRUE solar time at the site (the sky model puts the Sun due south or north at 12:00)
  const [sol, setSol] = useState(() => localTrueSolarTime(SITES.find((x) => x.id === 'gale').lon).sol);
  const [lst, setLst] = useState(() => localTrueSolarTime(SITES.find((x) => x.id === 'gale').lon).lst);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState('phobos');
  const [search, setSearch] = useState(null); // null | 'busy' | { sol } | { none: true }

  // Jump to the next sol with a Phobos transit visible from this site. The 400-sol search takes about 2 s, so it
  // runs in batches of 20 sols with a pause between them: the page stays responsive and the spinner keeps turning.
  const findTransit = () => {
    playUiClick?.();
    setSearch('busy');
    const at = site;
    const BATCH = 20;
    const MAX = 400;
    const step = (from) => {
      const found = nextTransitSol(at.lat, from, BATCH - 1, at.lon);
      if (found != null) {
        const tl = solTimeline(at.lat, found, 1, at.lon);
        setPlaying(false);
        setSol(found);
        setLst(Math.max(0, tl.transit.lst - 0.03));
        setSelected('phobos');
        setSearch({ sol: found });
        return;
      }
      if (from + BATCH > sol + MAX) { setSearch({ none: true }); return; }
      setTimeout(() => step(from + BATCH), 0);
    };
    setTimeout(() => step(sol + 1), 30);
  };

  // "Now" in local true solar time at a site
  const goNow = (s = site) => {
    setSearch(null);
    const now = localTrueSolarTime(s.lon);
    setSol(now.sol);
    setLst(now.lst);
  };

  // A rover photo gives its mission sol: turn it into the local sol on the MSD scale before showing that sky
  const syncToMoment = (missionSol, lstHour, siteId, rover) => {
    playUiClick?.();
    setSearch(null);
    setPlaying(false);
    const s = SITES.find((x) => x.id === siteId);
    if (s) setSite(s);
    const base = MISSION_SOL0[rover];
    setSol(base !== undefined ? base + missionSol : missionSol);
    setLst(lstHour);
  };

  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(() => setLst((v) => {
      const n = v + 0.06;
      if (n >= 24) { setSol((x) => x + 1); return n - 24; }
      return n;
    }), 60);
    return () => clearInterval(t);
  }, [playing]);

  const sky = useMemo(() => skyAt(site.lat, sol, lst, site.lon), [site, sol, lst]);
  const objects = useMemo(() => starsAndPlanets(site.lat, sol, lst, FAINT_STARS, site.lon), [site, sol, lst]);
  const timeline = useMemo(() => solTimeline(site.lat, sol, 0.1, site.lon), [site, sol]);
  const ls = lsFromMsd(msdFromLocalSolarTime(sol, lst, site.lon));

  const nextEvent = (key, kind) => {
    const list = timeline.events[key][kind];
    return list.find((t) => t > lst) ?? list[0];
  };
  const sunUp = timeline.events.sun;
  const earthWindow = timeline.samples.filter((p) => p.earth > 10).length * 0.1 * (MARS_SOL_HOURS / 24);

  const row = (key, extra) => {
    const b = sky[key];
    const up = b.alt > 0;
    const B = BODIES[key];
    const Icon = B.icon;
    const rise = nextEvent(key, 'rises');
    const set = nextEvent(key, 'sets');
    return (
      <button key={key} onClick={() => setSelected(key)} className={`w-full text-left rounded-xl border p-3 transition-colors cursor-pointer ${selected === key ? 'border-white/40 bg-white/[0.08]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-semibold"><Icon className="w-4 h-4" style={{ color: B.color }} />{B.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${up ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-zinc-400'}`}>{up ? `${Math.round(b.alt)}° up, ${compass(b.az)}` : 'Below horizon'}</span>
        </div>
        <div className="mt-1.5 text-xs text-zinc-400 flex flex-wrap gap-x-3 gap-y-0.5">
          {rise != null && <span>Rises {fmt(rise)}</span>}
          {set != null && <span>Sets {fmt(set)}</span>}
          {extra}
        </div>
      </button>
    );
  };

  const t = timeline.transit;
  const earthNote = sky.earth.elongation < 3
    ? 'Earth is behind the Sun from here: radio contact is blocked for days around solar conjunction.'
    : `Earth is ${Math.round(sky.earth.elongation)}° from the Sun, so it shines as ${sky.earth.evening ? 'an evening star after sunset' : 'a morning star before sunrise'}.`;

  return (
    <div className="relative min-h-screen text-white font-sans -mt-20 sm:-mt-24 -mx-3 sm:-mx-8 lg:-mx-14">
      {/* Background: a Martian canyon under the Milky Way */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/textures/sky-canyon.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-[#03040a]/60 to-[#03040a]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#03040a]/80 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1500px] w-full min-w-0 mx-auto px-3 sm:px-8 lg:px-14 pt-24 sm:pt-28 pb-20 sm:pb-24">
        <header className="max-w-3xl">
          <p className="text-sm font-medium text-[#ffa07f] flex items-center gap-2"><Telescope className="w-4 h-4" />Sky Watch</p>
          <h1 className="mt-2 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.04]">Look up from Mars.</h1>
          <p className="mt-4 text-lg text-zinc-300 leading-relaxed">
            See where the Sun, Phobos, Deimos and Earth are from any site, hour by hour. Know when daylight ends, when Earth is in view for a radio call home, and when Phobos dims the Sun.
          </p>
        </header>

        {/* Site + time */}
        <div className="mt-8 grid lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#070a12]/70 backdrop-blur-xl p-4">
            <div className="text-xs text-zinc-400 mb-2">Where are you standing?</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SITES.map((s) => (
                <button key={s.id} onClick={() => { playUiClick?.(); setSite(s); goNow(s); }} className={`text-left rounded-xl border px-3 py-2 transition-colors cursor-pointer ${site.id === s.id ? 'border-[#ff7b4d]/60 bg-[#ff7b4d]/10' : 'border-white/[0.07] hover:bg-white/[0.05]'}`}>
                  <div className="text-sm font-semibold leading-tight">{s.name}</div>
                  <div className="text-xs text-zinc-400">{s.sub} · {Math.abs(s.lat)}°{s.lat >= 0 ? 'N' : 'S'}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#070a12]/70 backdrop-blur-xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xs text-zinc-400" title="Local true solar time (the Sun is highest at 12:00). The number is the Mars Sol Date, the sol count used for the whole planet.">Local solar time · Mars Sol Date {sol}</div>
                <div className="text-4xl font-semibold tabular-nums font-mono">{fmt(lst)}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{seasonFromLs(ls)} · Ls {ls.toFixed(0)}°</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPlaying((v) => !v)} className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-white text-black font-semibold px-3 py-2 text-sm hover:bg-zinc-200 cursor-pointer">
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{playing ? 'Pause' : 'Play sol'}
                </button>
                <button onClick={() => { setPlaying(false); goNow(); }} className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10 cursor-pointer">Now</button>
              </div>
            </div>
            <input type="range" min="0" max="23.99" step="0.01" value={lst} onChange={(e) => { setPlaying(false); setLst(Number(e.target.value)); }} aria-label="Local solar time" className="w-full accent-[#ff7b4d] cursor-pointer" />
          </div>
        </div>

        {/* Dome + bodies */}
        <div id="sky-overhead-section" className="mt-6 grid lg:grid-cols-12 gap-6 items-start">
          <Panel title="The sky overhead" icon={Telescope} className="lg:col-span-7" right={<span className="text-xs text-zinc-400">Looking straight up · lines show the whole sol</span>}>
            <SkyDome
              sky={sky}
              objects={objects}
              timeline={timeline}
              selected={selected}
              onSelect={setSelected}
              onDragTime={(dh) => { setPlaying(false); setLst((v) => (((v + dh) % 24) + 24) % 24); }}
            />
            <p className="mt-3 text-xs text-zinc-500 text-center">Point at anything to name it · drag sideways to move time · east is on the left because you are looking up.</p>
          </Panel>

          <div className="lg:col-span-5 flex flex-col gap-3">
            <Panel title="In the sky now" icon={Clock}>
              <div className="space-y-2">
                {row('sun', sunUp.rises.length || sunUp.sets.length
                  ? <span title="Sunlight arriving at the top of the atmosphere, on a surface facing the Sun">{sky.sun.alt > 0 ? `${Math.round(sky.sun.fluxWm2)} W/m² above the air` : 'Night: no sunlight'}</span>
                  : <span>{timeline.samples.some((p) => p.sun > 0) ? 'Up all sol' : 'Polar night'}</span>)}
                {row('phobos', site.lat > 70 ? <span>Never rises this far north</span> : <span>{sky.phobos.eclipsed ? "In Mars's shadow" : `${Math.round(sky.phobos.illumination * 100)}% lit`} · {Math.round(sky.phobos.distKm).toLocaleString()} km</span>)}
                {row('deimos', <span>{Math.round(sky.deimos.illumination * 100)}% lit · looks like a bright star</span>)}
                {row('earth', <span>{sky.earth.distAu.toFixed(2)} AU away</span>)}
              </div>
              <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs text-zinc-300">
                <span className="text-zinc-400">Planets above the horizon: </span>
                {objects.filter((o) => o.kind === 'planet' && o.alt > 0).map((o) => `${o.name} (${Math.round(o.alt)}°, ${compass(o.az)})`).join(' · ') || 'none right now'}
                {sky.sun.alt > -4 && objects.some((o) => o.kind === 'planet' && o.alt > 0) && <span className="text-zinc-500"> · lost in daylight until dusk</span>}
              </div>
            </Panel>
          </div>
        </div>

        {/* Altitude chart */}
        <Panel title="Over the whole sol" icon={Sun} className="mt-6" right={<span className="text-xs text-zinc-400">Height above the horizon · tap to jump in time</span>}>
          <div className="h-64 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline.samples} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} onClick={(e) => { if (e?.activeLabel != null) { setPlaying(false); setLst(Number(e.activeLabel)); } }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                {sunUp.rises[0] != null && sunUp.sets[0] != null && sunUp.rises[0] < sunUp.sets[0] && (
                  <ReferenceArea x1={sunUp.rises[0]} x2={sunUp.sets[0]} fill="#fbbf24" fillOpacity={0.06} />
                )}
                <XAxis dataKey="lst" type="number" domain={[0, 24]} ticks={[0, 6, 12, 18, 24]} tickFormatter={(v) => `${String(v).padStart(2, '0')}:00`} stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis domain={[-90, 90]} ticks={[-90, -45, 0, 45, 90]} stroke="#71717a" fontSize={11} unit="°" width={44} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${fmt(v)} local time`} formatter={(v, n) => [`${Math.round(v)}°`, BODIES[n]?.name || n]} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" label={{ value: 'Horizon', position: 'insideTopLeft', fill: '#a1a1aa', fontSize: 11 }} />
                <ReferenceLine x={lst} stroke="#fff" strokeDasharray="4 4" />
                {Object.entries(BODIES).map(([key, B]) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={B.color} strokeWidth={selected === key ? 2.6 : 1.4} strokeOpacity={selected === key ? 1 : 0.6} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(BODIES).map(([key, B]) => (
              <button key={key} onClick={() => setSelected(key)} className={`flex items-center gap-2 text-xs rounded-full px-3 py-1 border cursor-pointer ${selected === key ? 'border-white/40 bg-white/10' : 'border-white/10'}`}>
                <span className="w-3 h-0.5 rounded" style={{ background: B.color }} />{B.name}
              </button>
            ))}
          </div>
        </Panel>

        {/* Survival-relevant cards + NASA Rover Astrophotography Archive */}
        <div className="mt-6 grid lg:grid-cols-3 gap-6 items-start w-full min-w-0 max-w-full">
          <div className="lg:col-span-2 flex flex-col gap-6 w-full min-w-0 max-w-full">
            <div className="grid sm:grid-cols-2 gap-6 items-start w-full min-w-0">
              <Panel title="Daylight for an EVA" icon={Sun}>
                {sunUp.rises.length && sunUp.sets.length ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><div className="text-xs text-zinc-400">Sunrise</div><div className="text-xl font-semibold tabular-nums">{fmt(sunUp.rises[0])}</div></div>
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><div className="text-xs text-zinc-400">Sunset</div><div className="text-xl font-semibold tabular-nums">{fmt(sunUp.sets[sunUp.sets.length - 1])}</div></div>
                    </div>
                    <p className="mt-3 text-sm text-zinc-300">Highest sun today: <strong className="text-white">{Math.round(Math.max(...timeline.samples.map((p) => p.sun)))}°</strong>. Plan to be back before sunset: the cold and dark arrive within minutes.</p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-300">{timeline.samples.some((p) => p.sun > 0) ? 'Polar day: the Sun never sets here this season.' : 'Polar night: the Sun stays below the horizon all sol. No solar power, no daylight EVA.'}</p>
                )}
                <p className="mt-3 text-xs text-zinc-500">Martian sunsets are blue: fine dust scatters blue light forward, around the Sun.</p>
              </Panel>

              <Panel title="Calling Earth" icon={Radio}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><div className="text-xs text-zinc-400">Signal delay, one way</div><div className="text-xl font-semibold tabular-nums">{sky.earth.lightMinutes.toFixed(1)} min</div></div>
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"><div className="text-xs text-zinc-400">Earth well above horizon</div><div className="text-xl font-semibold tabular-nums">{earthWindow.toFixed(1)} h</div></div>
                </div>
                <p className="mt-3 text-sm text-zinc-300">{earthNote}</p>
                <p className="mt-2 text-sm text-zinc-300">A question to Mission Control and its answer take <strong className="text-white">{(sky.earth.lightMinutes * 2).toFixed(0)} min</strong> at best. In an emergency on an EVA, the crew decides alone.</p>
                <p className="mt-3 text-xs text-zinc-500">Direct radio to Earth needs Earth above the horizon (here: more than 10°); orbiters relay the rest of the time.</p>
              </Panel>
            </div>

            {/* NASA Rover Astrophotography Archive */}
            <div className="w-full min-w-0 max-w-full overflow-hidden">
              <RoverAstrophotography onSyncMoment={syncToMoment} />
            </div>
          </div>

          <div className="lg:col-span-1 flex flex-col gap-4 w-full min-w-0 max-w-full">
            <Panel title="Phobos crosses the Sun" icon={Eclipse}>
              {site.lat > 70 ? (
                <p className="text-sm text-zinc-300">Phobos never rises above 70° latitude, so there are no transits here.</p>
              ) : (
                <>
                  <p className="text-sm text-zinc-300 mb-3">
                    {t?.happens
                      ? <>This sol Phobos passes in front of the Sun at <strong className="text-white">{fmt(t.lst)}</strong>, for about <strong className="text-white">{Math.round(t.durationS)} s</strong>, covering up to <strong className="text-white">{Math.round(t.maxCover * 100)}%</strong> of it.</>
                      : <>No transit from here this sol{t ? `: the closest pass is ${t.sepDeg.toFixed(1)}° from the Sun` : ''}. Drag Phobos below to see one.</>}
                  </p>
                  <TransitViewer transit={t} fluxWm2={sky.sun.fluxWm2} siteName={site.name} />
                  <button onClick={findTransit} disabled={search === 'busy'} className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 text-amber-100 py-2.5 text-sm font-medium hover:bg-amber-500/20 transition disabled:opacity-60 cursor-pointer">
                    {search === 'busy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {search === 'busy' ? 'Searching the coming sols…' : 'Find the next transit from here'}
                  </button>
                  {search?.none && <p className="mt-2 text-xs text-zinc-400">No transit from this site in the next 400 sols.</p>}
                  <p className="mt-3 text-[11px] text-zinc-500 leading-relaxed">
                    The Sun, Earth and planets come from orbital elements. Phobos and Deimos use simple circular orbits, so their positions and transit times are approximate: the transit dates here do not match the real ones rovers photographed.
                  </p>
                </>
              )}
            </Panel>

            {/* Astronomical Insights & Facts filling the right side */}
            {[
              ['Phobos is falling', 'It orbits just 6,000 km up and spirals in by about 1.8 m every century. In 30 to 50 million years it will break apart into a ring.'],
              ['Two very different moons', 'Phobos rises in the west and crosses the sky in about 4 hours. Deimos is so slow it can stay up for more than two sols.'],
              ['Earth, the evening star', 'From Mars, Earth never strays more than about 47° from the Sun, so you only see it near dusk or dawn, with the Moon beside it.'],
            ].map(([h, p]) => (
              <motion.div
                key={h}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35 }}
                className="rounded-2xl border border-white/10 bg-[#070a12]/75 backdrop-blur-xl p-4 shadow-lg"
              >
                <div className="font-semibold text-sm text-white">{h}</div>
                <p className="mt-1 text-xs text-zinc-300 leading-relaxed">{p}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-xs text-zinc-500 flex items-start gap-2 max-w-4xl">
          <Info className="w-4 h-4 shrink-0" />
          Sun position from the Mars24 season model (Allison &amp; McEwen 2000). Earth from JPL Keplerian elements of Earth and Mars. Phobos and Deimos use their real orbit sizes and periods with full parallax, but their starting position is not tied to a live ephemeris, so moonrise and transit times are representative, not predictions.
        </p>
      </div>
    </div>
  );
}

// Memoised: switching tabs re-renders App, and this page has no props that change, so it can skip that work
export default memo(MartianSkyEphemeris);
