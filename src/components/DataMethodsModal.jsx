import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Database, Cpu, FlaskConical, ShieldCheck } from 'lucide-react';
import useMapStore from '../store/useMapStore';
import { EVA_ASSUMPTIONS } from '../terrain/evaModel';
import { ROVER } from '../terrain/roverModel';
import MlScorecard from './MlScorecard';

// Every source the app draws on, grouped by what it is used for. Anything not listed here is not in the app.
const GROUPS = [
  {
    title: 'Terrain and routes',
    items: [
      {
        name: 'HRSC-MOLA Blended DEM, 200 m/px',
        use: 'Terrain for slope, route planning, the point of no return and radio coverage. Seven areas ship with the app; for any other walk, the tiles around your two points are fetched from NASA/USGS on demand (about 163 m per pixel) and cropped to the walk. Longer routes use the same data at lower detail (326 m to 2.6 km per pixel) so the whole area fits; routes over 800 km use the global MOLA grid below.',
        cite: 'Fergason et al. 2018, USGS Astrogeology (tiles: astro.arcgis.com Mars200mDEM)',
        href: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m',
      },
      {
        name: 'MGS MOLA MEGDR topography, 4 px/deg',
        use: 'Global elevation (coarse), the elevation readout anywhere, the relief shading on the 3D globe, and routes longer than 800 km',
        cite: 'Smith et al., PDS Geosciences Node',
        href: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html',
      },
      {
        name: 'Official NASA rover traverse paths (Opportunity, Perseverance, Curiosity, Spirit, Sojourner)',
        use: 'All 5 historical NASA surface rover tracks (128.98 km total PDS odometry) for tactical navigation overlays and real-world pathfinding validation benchmarks',
        cite: 'NASA/JPL MMGIS & Analyst\'s Notebook (PDS Geosciences Node)',
        href: 'https://mars.nasa.gov/maps/',
      },
      {
        name: 'USGS / IAU Gazetteer of Planetary Nomenclature (2,055 Approved Features)',
        use: 'Complete Martian surface gazetteer spanning 8 morphological families (craters, montes, valles, fossae, plains, chaos) enriched with MOLA MEGDR DEM elevations',
        cite: 'USGS Astrogeology & IAU Working Group for Planetary System Nomenclature (WGPSN)',
        href: 'https://planetarynames.wr.usgs.gov/',
      },
    ],
  },
  {
    title: 'Imagery on the 2D map and the 3D globe',
    items: [
      {
        name: 'THEMIS daytime infrared mosaic, 100 m/px',
        use: 'The detail in the 2D map, and in the 3D globe once you zoom in',
        cite: 'Mars Odyssey THEMIS, Edwards et al. 2011, via NASA Mars Trek',
        href: 'https://trek.nasa.gov/mars/',
      },
      {
        name: 'Viking MDIM 2.1 colour mosaic, 232 m/px',
        use: 'The colour of the planet: the 3D globe\'s base texture, and the colour blended into the 2D and 3D detail',
        cite: 'Archinal et al. 2006, USGS / NASA Mars Trek',
        href: 'https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m',
      },
      {
        name: 'HRSC-MOLA shaded relief, 200 m/px',
        use: 'Light and shadow laid over the photos so the ground has real depth',
        cite: 'USGS Astrogeology via NASA Mars Trek',
        href: 'https://trek.nasa.gov/mars/',
      },
      {
        name: 'MRO CTX mosaic, about 5 m/px',
        use: 'Sharp imagery when you zoom far into the 2D map',
        cite: 'Dickson et al. 2018, Caltech and USGS (OnMars service)',
        href: 'https://astrogeology.usgs.gov/search/map/mars_mro_ctx_controlled_mosaics_global',
      },
      {
        name: 'Other Mars Trek layers',
        use: 'THEMIS night infrared, MOLA colour and elevation, TES dust, albedo and thermal inertia, MOLA roughness, in the Base map list',
        cite: 'NASA/JPL Mars Trek',
        href: 'https://trek.nasa.gov/mars/',
      },
      {
        name: 'NASA Image and Video Library',
        use: 'Image gallery and place photos (not georeferenced, so no map position is shown)',
        cite: 'NASA',
        href: 'https://images.nasa.gov/',
      },
      {
        name: 'NASA Mars Rover Raw Photos API (mars.nasa.gov)',
        use: 'In-situ raw EDR frames for Perseverance and Curiosity filtered by Sol, optical camera (Mastcam-Z, SuperCam RMI, WATSON, Navcam, Hazcam), and telemetry metadata',
        cite: 'NASA/JPL-Caltech Raw Images Telemetry Feed',
        href: 'https://mars.nasa.gov/multimedia/raw-images/',
      },
    ],
  },
  {
    title: 'Marsquakes and the inside of Mars',
    items: [
      {
        name: 'InSight Marsquake Service catalogue, V14',
        use: 'The count of marsquakes, the largest event, meteorite impacts, and which events InSight could place on the map (distance and direction from the lander)',
        cite: 'InSight Marsquake Service 2023: ETH Zurich, IPGP, JPL, Imperial College, Bristol. DOI 10.12686/a21',
        href: 'https://doi.org/10.12686/a21',
      },
      {
        name: 'USGS Geologic Map of Mars (SIM 3292), structure layer',
        use: 'The fault lines drawn on the map: grabens, wrinkle ridges and pit crater chains, 1,972 lines of tectonic origin',
        cite: 'Tanaka et al. 2014, USGS Scientific Investigations Map 3292',
        href: 'https://doi.org/10.3133/sim3292',
      },
      {
        name: 'InSight studies of the interior',
        use: 'The layers of Mars: crust (Knapmeyer-Endrun et al. 2021), lithosphere and mantle (Khan et al. 2021), the change near 1,000 km (Huang et al. 2022), the molten rock layer and the liquid core (Khan et al. 2023; Samuel et al. 2023), the solid inner core (Bi et al. 2025)',
        cite: 'Science 373 (2021); PNAS 119 (2022); Nature 622 (2023); Nature 645 (2025)',
        href: 'https://doi.org/10.1038/s41586-025-09361-9',
      },
      {
        name: 'Mars orbiter orbits & JPL Horizons API',
        use: 'The Orbiters layer on the 3D globe and live Horizons ephemeris: MRO, Mars Odyssey, ExoMars TGO, MAVEN and Mars Express, with real-time osculating state vectors, Earth-Mars communications light delay, and UHF surface relay passes',
        cite: 'NASA JPL Solar System Dynamics (SSD) Group & mission fact sheets',
        href: 'https://ssd.jpl.nasa.gov/api/horizons.api',
      },
    ],
  },
  {
    title: 'Science Lab: Perseverance instrument data',
    items: [
      {
        name: 'SuperCam calibrated LIBS spectra (Mars 2020 — 20 Rock Campaigns)',
        use: 'The laser spectra: 30 real shots at each of five points across 20 Jezero rocks (18,500+ spectra), three spectrometers (243–341, 379–465 and 538–853 nm). The average leaves out dust-clearing shots',
        cite: 'Wiens et al. 2021, Space Science Reviews; NASA PDS Geosciences Node, mars2020_supercam, data_calibrated_spectra',
        href: 'https://pds-geosciences.wustl.edu/missions/mars2020/supercam.htm',
      },
      {
        name: 'PIXL oxide compositions and positions (Mars 2020 — 20 Rock Campaigns)',
        use: 'The chemistry maps: oxide weight percent of every analysed point (both detectors combined) joined to its spatial position on 20 authentic Jezero rock targets',
        cite: 'Allwood et al. 2020, Space Science Reviews; PDS mars2020_pixl, data_oxides_pmc and data_processed',
        href: 'https://pds-geosciences.wustl.edu/missions/mars2020/pixl.htm',
      },
      {
        name: 'SHERLOC calibrated spectra and spot positions (Mars 2020)',
        use: 'The deep-UV glow and Raman spectra of every spot in a scan, and where each spot sits on the context photo',
        cite: 'Bhartia et al. 2021, Space Science Reviews; PDS mars2020_sherloc, data_processed',
        href: 'https://pds-geosciences.wustl.edu/missions/mars2020/sherloc.htm',
      },
      {
        name: 'Official NASA Mars Sample Return (MSR) Sample Cache Manifest',
        use: 'Complete dossier of all 38 Perseverance sample tubes, including 24 sealed rock cores, 10 tubes deposited at the Three Forks Sample Depot, and remaining available tubes',
        cite: 'NASA/JPL-Caltech Mars 2020 Sample Dossier & PDS Geosciences Node',
        href: 'https://mars.nasa.gov/mars2020/mission/science/samples/',
      },
      {
        name: 'Mars 2020 raw images and rover waypoints',
        use: 'The SuperCam and SHERLOC photos of each rock, and the rover position on the sols of each study',
        cite: 'NASA/JPL-Caltech raw image archive; NASA/JPL MMGIS waypoints',
        href: 'https://mars.nasa.gov/mars2020/multimedia/raw-images/',
      },
      {
        name: 'NIST atomic emission lines and average Martian soil',
        use: 'Names for the peaks of the laser spectra (nearest known line within 0.14 nm), and the soil bars in the chemistry chart',
        cite: 'NIST Atomic Spectra Database; Taylor & McLennan 2009',
        href: 'https://physics.nist.gov/PhysRefData/ASD/lines_form.html',
      },
    ],
  },
  {
    title: 'Water, shelter and surface conditions',
    items: [
      {
        name: 'Mars Odyssey GRS elemental abundance maps (Fe, Si, K, Th, Cl, H₂O)',
        use: 'Planetary resource layers & ISRU feasibility: water equivalent hydrogen and global elemental weight percentages in the top metre of soil',
        cite: 'Boynton et al. 2007, NASA PDS Geosciences Node',
        href: 'https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html',
      },
      {
        name: 'Mars Global Cave Candidate Catalog',
        use: 'SHELTER layer: about 1,060 pits and skylights that could shelter a crew',
        cite: 'Cushing 2017, USGS Astrogeology / PDS',
        href: 'https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing',
      },
      {
        name: 'Curiosity RAD dose rates & NASA DONKI Space Weather (api.nasa.gov)',
        use: 'Ground-truth dosimetric telemetry (Sols 13–4250) joined with live DONKI Coronal Mass Ejections (CME), Solar Flares (FLR), and Solar Particle Events (SPE) transit calculations',
        cite: 'Hassler et al. 2014, Science; NASA-STD-3001; NASA GSFC Space Weather Center of Excellence (DONKI)',
        href: 'https://api.nasa.gov/',
      },
      {
        name: 'NASA / PSI Mars Dust Storm Track Database (MDSTD)',
        use: 'Interactive dust storm layers & trajectory vector forecasts: 1,050 individually tracked local, regional, and planet-encircling storms across Mars Years 24 to 36',
        cite: 'Battalio & Wang 2019, 2021; Cantor et al. 2019; Planetary Science Institute / NASA',
        href: 'https://www.psi.edu/',
      },
      {
        name: 'Multi-Station Surface Weather Network (MEDA, REMS, APSS)',
        use: 'Simultaneous multi-station atmospheric telemetry: Perseverance MEDA at Jezero Crater, Curiosity REMS at Gale Crater, and InSight APSS at Elysium Planitia',
        cite: 'NASA Mars Weather Service, CAB (CSIC-INTA), and PDS Atmospheres Node',
        href: 'https://mars.nasa.gov/weather/',
      },
      {
        name: 'NASA PDS Solar Array Power Telemetry',
        use: 'MER Opportunity (5,352 sols) and InSight (1,440 sols) Pancam tau, dust factor degradation curves, and convective cleaning vortex records',
        cite: 'NASA PDS Atmospheres Node (Lemmon et al.) & PDS Geosciences Node (Lorenz et al.)',
        href: 'https://pds-atmospheres.nmsu.edu/',
      },
    ],
  },
  {
    title: 'Sun, sky and time',
    items: [
      {
        name: 'Areocentric solar longitude, Mars time and the subsolar point',
        use: 'Season, sunrise and sunset, local solar time on a walk, and the real Sun position on the 3D globe',
        cite: 'Allison & McEwen 2000, Planetary and Space Science',
        href: 'https://doi.org/10.1016/S0032-0633(99)00092-6',
      },
      {
        name: 'Planet positions, Mars pole and the moons',
        use: 'Sky Watch: Earth, Mercury, Venus, Jupiter and Saturn from approximate orbital elements, the IAU Mars pole, and Phobos and Deimos orbits',
        cite: 'JPL Solar System Dynamics; Archinal et al. 2018, IAU WGCCRE',
        href: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
      },
    ],
  },
];

const MODELS = [
  ['Walking energy', 'Minetti et al. 2002 gradient cost of walking, scaled by Mars gravity (0.38 g), plus a resting load'],
  ['Walking speed', "Tobler's hiking function rescaled to the suited pace below"],
  ['Rover speed', 'About 10 km/h on flat ground, slowing on slopes to a 2 km/h crawl and stopping at 20°, like the six-wheeled pressurised rovers NASA has tested'],
  ['Route planner', 'A* search on the elevation grid (16 directions) minimising the chosen cost; steps steeper than the slope limit are impassable. Points can be any distance apart: the further apart, the coarser the terrain grid, so long routes show the general line, not every rock'],
  ['Point of no return', 'Cheapest-path energy from the base and from your position, compared with the remaining life-support budget'],
  ['Radio coverage', 'Line of sight from a 10 m antenna to a receiver 2 m above ground, including terrain and Mars curvature'],
  ['Marsquake positions', 'InSight had one seismometer, so a quake has a distance and, for the best events only, a direction. Its place is found by moving that distance along that direction on a sphere the size of Mars'],
  ['Risk zones', 'A relative index per 1° cell: mapped fault length per area (grabens count full, wrinkle ridges half, fresher faults more), smoothed, plus where InSight placed quakes weighted by size. Four levels are cut by share of the planet\'s area. It is not an official hazard map'],
  ['Conditions on a walk', 'The Sun\'s height and the time of day are real geometry. Air temperature, pressure, wind and dust come from a seasonal model shaped by the time of day, and dose rate from the radiation model'],
  ['Science Lab peaks', 'Peaks of each measured laser spectrum are found above a floor drawn under the curve and named by the nearest known atomic line. Peak height is not an amount; PIXL gives the amounts'],
  ['Science Lab Raman and glow', 'SHERLOC regions 2 and 3 are joined at 338 nm for the glow spectrum. The Raman glow background is a smooth floor under the peaks; strength is the peak height over the point-to-point noise of the average. Reference bands are from the literature and are clues, not identifications'],
  ['Rock type label', 'Worked out from the PIXL median: 10% SO₃ or more is sulfate-rich, MgO plus FeO of 40% or more with 44% SiO₂ or less is olivine-rich, otherwise basaltic below 52% SiO₂'],
  ['Orbiters & Ephemeris', 'Live Keplerian orbital propagation from NASA JPL Horizons API with J₂ oblateness perturbations, solving Kepler\'s equation with Newton-Raphson iteration for real-time true anomalies and line-of-sight UHF comms passes'],
];

const SIMULATED = [
  'Machine learning: weather and dust-storm risk are learnt from 4,745+ Curiosity REMS sols (the storm label is a temperature-range proxy); rock types from 18,500+ PIXL spectra across 20 Jezero rocks classified by a 25-tree Random Forest ensemble; their scores are in the section above',
  'Solar array power degradation: calibrated from authentic MER Opportunity (5,352 sols) and InSight Lander (1,440 sols) NASA PDS daily flight telemetry and Pancam optical depth (tau) curves',
  'Radiation, terramechanics, and marsquake shaking are ML surrogates: fitted to simulated data from physics formulas anchored to published Curiosity RAD, rover mobility, and InSight benchmarks',
  'Science Lab Core Drill and astrobiology scores: depth layers, organic carbon and the biogenic score are an illustrative model below the measured rock surface; ISRU Forge is a speculative concept',
  'Astronaut Biometrics: deterministic metabolic power expenditure derived from terrain slope via NASA SP-2010-3407 suited human models',
  'The walk and drive animation: speeds come from the empirical models above, sped up to watch',
  'Marsquake places are approximate (one seismometer), and risk zones are a derived index, not a hazard forecast',
  'Background scenes on the Home, Science Lab, Sky Watch and Drills pages are artwork, not photos of Mars',
  'Science Lab: spectra, maps and numbers are measured; the plain-language reading of them, the pH chart and the AI explanation are interpretation, not NASA results',
  '2 km / 5 km walkback rings: team planning assumptions, not NASA requirements',
  'AI assistant Eva and the Science Lab explanation (Google Gemini 2.5 Flash): Eva chooses where to go and never supplies elevations, slopes or distances; the explanation only reads the measured numbers shown',
];

export default function DataMethodsModal() {
  const open = useMapStore((s) => s.isDataMethodsOpen);
  const setOpen = useMapStore((s) => s.setDataMethodsOpen);
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    if (!open || validation) return;
    fetch('/data/validation.json').then((r) => (r.ok ? r.json() : null)).then(setValidation).catch(() => {});
  }, [open, validation]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const a = EVA_ASSUMPTIONS;

  return (
    <AnimatePresence>
      {open && (
        <div key="data-methods" className="fixed inset-0 z-[650] flex items-center justify-center p-3 sm:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="relative w-full max-w-3xl max-h-[88vh] flex flex-col bg-[#07090E]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden font-sans text-white"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
              <div>
                <div className="text-xs font-medium text-[#ff8c69]">Transparency</div>
                <h2 className="text-lg font-bold">Data &amp; Methods</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-6 text-sm custom-scrollbar-y">
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-300 mb-1"><Database className="w-4 h-4" />NASA and partner data used</h3>
                <p className="text-xs text-zinc-400 mb-3">Every dataset in the app, grouped by what it is used for. Tap a name to open the source.</p>
                <div className="space-y-5">
                  {GROUPS.map((g) => (
                    <div key={g.title}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">{g.title}</h4>
                      <ul className="space-y-2">
                        {g.items.map((d) => (
                          <li key={d.name} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                            <a href={d.href} target="_blank" rel="noreferrer" className="font-semibold text-white hover:text-cyan-300 underline-offset-2 hover:underline">{d.name}</a>
                            <p className="text-zinc-300 text-xs mt-1 leading-relaxed">{d.use}</p>
                            <p className="text-zinc-500 text-[11px] mt-1">{d.cite}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-300 mb-2"><Cpu className="w-4 h-4" />How the numbers are computed</h3>
                <ul className="space-y-1.5 text-zinc-300 text-xs">
                  {MODELS.map(([k, v]) => (
                    <li key={k}><span className="font-semibold text-white">{k}:</span> {v}</li>
                  ))}
                </ul>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  {[
                    ['Crew + suit mass', `${a.crewMassKg} + ${a.suitMassKg} kg`],
                    ['Level walking pace', `${a.flatSpeedKmh} km/h`],
                    ['Steepest walkable grade', `${a.maxSlopeDeg}°`],
                    ['Life support', `${a.lifeSupportHours} h at nominal workload`],
                    ['Emergency reserve', `${Math.round(a.reserveFraction * 100)}% of budget`],
                    ['Resting power', `${a.restingPowerW} W`],
                    ['Rover speed', `${ROVER.cruiseKmh} km/h, up to ${ROVER.maxSlopeDeg}°`],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-black/40 border border-white/[0.06] rounded p-2">
                      <div className="text-zinc-500 text-[9px] uppercase">{k}</div>
                      <div className="text-white">{v}</div>
                    </div>
                  ))}
                </div>
                <p className="text-zinc-500 text-[11px] mt-2">These are planning assumptions chosen by the team, not mission requirements. Terrain is about 200 m per pixel, so metre-scale hazards (boulders, small scarps) are not resolved.</p>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-300 mb-2"><ShieldCheck className="w-4 h-4" />Checked against real rover drives</h3>
                {validation ? (
                  <div className="space-y-2">
                    {validation.results.map((r) => (
                      <div key={r.site} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-xs text-zinc-300">
                        <div className="font-semibold text-white">{r.site} <span className="text-zinc-500 font-mono">({r.traverseKm} km of real driving)</span></div>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-zinc-400">
                          <li>{r.roverPathOver20DegPct}% of the real rover path is steeper than {a.maxSlopeDeg}° on our terrain (median {r.roverMedianSlopeDeg}°, 95th percentile {r.roverP95SlopeDeg}°): the elevation data agrees with where vehicles chose to drive.</li>
                          <li>On {r.directDrives} drives that went straight from A to B, planned routes were {r.plannedToRoverLengthMedian}x the distance the rover drove (median); planned routes are {r.plannedDetourVsStraightMedian}x the straight line.</li>
                        </ul>
                      </div>
                    ))}
                    <p className="text-zinc-500 text-[11px]">Reproduce with <span className="font-mono">WRITE_VALIDATION=1 npm test</span>. Rovers sometimes drive longer paths for science or to protect their wheels, so planned routes are expected to be somewhat shorter.</p>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs">Loading validation results...</p>
                )}
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-300 mb-1"><Cpu className="w-4 h-4" />Machine learning: how good is each model?</h3>
                <p className="text-xs text-zinc-400 mb-3">Every score is measured on data the model did not train on, next to the simple baseline it has to beat.</p>
                <MlScorecard />
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-300 mb-2"><FlaskConical className="w-4 h-4" />What is simulated</h3>
                <ul className="space-y-1 text-zinc-300 text-xs list-disc list-inside">
                  {SIMULATED.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
