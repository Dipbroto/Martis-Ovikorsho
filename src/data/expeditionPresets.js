// Example expeditions: two follow real rover country (names are NASA's), two are imagined human EVAs.
// Distances are the straight legs between the stops; elevations are read from the 200 m HRSC-MOLA grids.

export const expeditionPresets = [
  {
    id: 'perseverance-jezero-delta',
    name: 'Perseverance: Jezero River Delta',
    mission: 'Mars 2020 / Human Precursor',
    category: 'Historical Rover & Human Exploration',
    description: 'Traverse across the ancient Jezero Crater lakebed, climbing up the river delta deposits to inspect ancient clay and silt layers that could preserve biosignatures.',
    distanceKm: 5.4,
    estHours: 2.0,
    targetRegion: 'Jezero Crater (18.44°N, 77.45°E)',
    center: [18.4447, 77.4508],
    zoom: 6,
    sciencePriority: 'Astrobiology & Lacustrine Biosignatures',
    waypoints: [
      { id: 'wp-jez-1', name: 'Octavia E. Butler Landing', lat: 18.4447, lon: 77.4508, elevation: -2573 },
      { id: 'wp-jez-2', name: 'Séítah Dune Field Margin', lat: 18.4410, lon: 77.4420, elevation: -2565 },
      { id: 'wp-jez-3', name: 'Three Forks Delta Inflow', lat: 18.4350, lon: 77.4250, elevation: -2542 },
      { id: 'wp-jez-4', name: 'Hawksbill Gap Outcrop', lat: 18.4420, lon: 77.4100, elevation: -2530 },
      { id: 'wp-jez-5', name: 'Skinner Ridge (Mudstone Layer)', lat: 18.4510, lon: 77.3980, elevation: -2503 },
      { id: 'wp-jez-6', name: 'Kodiak Remnant Butte Lookoff', lat: 18.4620, lon: 77.3850, elevation: -2470 },
      { id: 'wp-jez-7', name: 'Delta Top Ingress & Sample Cache', lat: 18.4730, lon: 77.3710, elevation: -2413 }
    ],
    timeline: [
      { time: '00:00', title: 'EVA Ingress & Systems Check', description: 'Suit pressure 29.6 kPa verified. Navigation beacon synced with Perseverance rover base.' },
      { time: '01:15', title: 'Séítah Sand Margin Crossing', description: 'Deploy penetrometer to measure soil compaction for rover wheel tractability.' },
      { time: '02:30', title: 'Three Forks Rock Coring', description: 'Extract core sample #01: Olivine-bearing cumulate rock with carbonate coatings.' },
      { time: '03:45', title: 'Hawksbill Fine-Grained Sediments', description: 'SuperCam Raman scan for aromatic organic molecules in lacustrine mudstone.' },
      { time: '04:45', title: 'Delta Top Depot Drop & Return', description: 'Deposit sealed titanium sample tube into ground depot for Mars Sample Return.' }
    ]
  },
  {
    id: 'olympus-mons-caldera',
    name: 'Human Mission 1: Olympus Mons Caldera Rim',
    mission: 'Imagined human mission',
    category: 'High-Altitude Volcanic Traverse',
    description: 'An imagined high-altitude trek from the rim of the Olympus Mons summit caldera down its collapse wall onto the caldera floor, about 18 km up.',
    distanceKm: 19.6,
    estHours: 7.9,
    targetRegion: 'Olympus Mons summit (18.65°N, 133.8°W)',
    center: [18.65, -133.8],
    zoom: 5,
    sciencePriority: 'Volcanology of the summit caldera',
    waypoints: [
      { id: 'wp-oly-1', name: 'Camp Schiaparelli (Rim Base)', lat: 18.6500, lon: -133.8000, elevation: 19968 },
      { id: 'wp-oly-2', name: 'Caldera Rim Overlook', lat: 18.6200, lon: -133.7200, elevation: 19966 },
      { id: 'wp-oly-3', name: 'Caldera Wall Descent', lat: 18.5800, lon: -133.6500, elevation: 18556 },
      { id: 'wp-oly-4', name: 'Caldera Floor Survey Point', lat: 18.5200, lon: -133.5800, elevation: 18162 },
      { id: 'wp-oly-5', name: 'Summit Caldera Floor', lat: 18.4700, lon: -133.5100, elevation: 18096 }
    ],
    timeline: [
      { time: '00:00', title: 'Summit Suit Check', description: 'Air pressure about 100 Pa, a sixth of the Mars average, this high up. Suit heaters on.' },
      { time: '02:00', title: 'Caldera Rim Geophone Array', description: 'Set out geophones to listen for marsquakes under the volcano.' },
      { time: '04:30', title: 'Caldera Wall LiDAR Profiling', description: 'Scan the layered collapse wall to read the volcano’s eruption history.' },
      { time: '07:00', title: 'Volcanic Glass Pyroclastic Sampling', description: 'Collect basalt samples from the foot of the caldera collapse wall.' }
    ]
  },
  {
    id: 'curiosity-gale-sharp',
    name: 'Curiosity: Mount Sharp Stratigraphy',
    mission: 'Mars Science Laboratory',
    category: 'Historical Rover Route',
    description: 'Follow Curiosity\'s historic route from Bradbury Landing on the lakebed floor up into the sulfate and clay-bearing stratigraphy of Mount Sharp (Aeolis Mons).',
    distanceKm: 13.0,
    estHours: 4.7,
    targetRegion: 'Gale Crater (-4.59°S, 137.44°E)',
    center: [-4.5895, 137.4417],
    zoom: 6,
    sciencePriority: 'Paleo-Climatic Transition & Habitability',
    waypoints: [
      { id: 'wp-gal-1', name: 'Bradbury Landing Site', lat: -4.5895, lon: 137.4417, elevation: -4503 },
      { id: 'wp-gal-2', name: 'Yellowknife Bay (Mudstone Basin)', lat: -4.5920, lon: 137.4480, elevation: -4505 },
      { id: 'wp-gal-3', name: 'Dingo Gap Dune Pass', lat: -4.6150, lon: 137.4200, elevation: -4496 },
      { id: 'wp-gal-4', name: 'Murray Buttes Sandstone Mesas', lat: -4.6700, lon: 137.3800, elevation: -4427 },
      { id: 'wp-gal-5', name: 'Vera Rubin Ridge (Hematite Crest)', lat: -4.7200, lon: 137.3500, elevation: -4298 },
      { id: 'wp-gal-6', name: 'Sulfate-Bearing Layer Gateway', lat: -4.7600, lon: 137.3200, elevation: -4193 }
    ],
    timeline: [
      { time: '00:00', title: 'Traverse Departure from Bradbury', description: 'Review ancient river pebble conglomerate beds.' },
      { time: '01:45', title: 'Yellowknife Bay Habitability Drill', description: 'Verify past presence of neutral pH water, sulfur, nitrogen, oxygen, and carbon.' },
      { time: '03:30', title: 'Vera Rubin Ridge Spectrometry', description: 'APXS scan of crystalline hematite veins formed by groundwater percolation.' },
      { time: '06:00', title: 'Sulfate Unit Boundary Mapping', description: 'Document the transition from wet Mars (clays) to arid hyper-saline Mars (sulfates).' }
    ]
  },
  {
    id: 'valles-marineris-canyon',
    name: 'Valles Marineris: Melas Chasma',
    mission: 'Imagined human mission',
    category: 'Canyon Descent & Layered Sediments',
    description: 'An imagined route inside Melas Chasma, part of the largest canyon system in the Solar System: landslide debris, sulfate mounds and a climb up the canyon wall.',
    distanceKm: 50.7,
    estHours: 31.7,
    targetRegion: 'Melas Chasma (-9.8°S, -76.5°E)',
    center: [-9.8, -76.5],
    zoom: 5,
    sciencePriority: 'Deep Crustal Stratigraphy & Water Ice Seeps',
    waypoints: [
      { id: 'wp-val-1', name: 'Melas North Terrace Landing', lat: -9.5000, lon: -76.2000, elevation: -2492 },
      { id: 'wp-val-2', name: 'Landslide Debris Fan Apron', lat: -9.6500, lon: -76.3500, elevation: -492 },
      { id: 'wp-val-3', name: 'Hydrated Sulfate Mound', lat: -9.8000, lon: -76.5000, elevation: -1920 },
      { id: 'wp-val-4', name: 'Melas Chasma Floor', lat: -9.9500, lon: -76.6800, elevation: -1144 },
      { id: 'wp-val-5', name: 'Canyon Wall Bluff (RSL streaks)', lat: -10.100, lon: -76.8200, elevation: 3256 }
    ],
    timeline: [
      { time: '00:00', title: 'Descent from Canyon Shoulder', description: 'Kilometres of canyon wall and thicker air overhead cut the cosmic-ray dose a little compared with the plains.' },
      { time: '02:30', title: 'Giant Landslide Breccia Survey', description: 'Measure colossal rock block sizes to model seismic collapse history.' },
      { time: '05:00', title: 'Canyon Floor Weather Station', description: 'Record air pressure and humidity: the air is denser down here than on the plateau.' },
      { time: '07:30', title: 'Warm Season RSL Seep Inspection', description: 'Inspect the dark slope streaks (RSL): seeping brine, or dry sand flows as recent orbital studies suggest?' }
    ]
  }
];
