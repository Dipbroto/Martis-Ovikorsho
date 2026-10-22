// The layers of Mars from the surface to the centre, as measured by NASA's InSight seismometer.
// Depths are in km below the surface (mean radius 3,389.5 km).
// - Crust: Knapmeyer-Endrun et al., Science 373 (2021): 24 to 72 km on average; about 20 or 39 km under InSight.
// - Lithosphere: Khan et al., Science 373 (2021): a rigid lid 400 to 600 km thick.
// - Mantle change near 1,000 km: Huang et al., PNAS 119 (2022): 1,006 ± 40 km.
// - Molten silicate layer about 150 km thick and core radius 1,675 ± 30 km, density about 6.65 g/cm3:
//   Khan et al., Nature 622 (2023); Samuel et al., Nature 622 (2023).
// - Solid inner core, radius about 613 ± 67 km: Bi et al., Nature 645 (2025).

export const MARS_RADIUS_KM = 3389.5;

export const INTERIOR = [
  {
    id: 'crust', name: 'Crust', top: 0, bottom: 40, color: '#d0956a',
    depth: 'Top 24 to 72 km (about 20 to 39 km under InSight)',
    state: 'Solid rock',
    made: 'Basalt and other volcanic rock. The top few kilometres are cracked and porous, and may hold ice or water deeper down.',
    how: 'Seismic waves bounced between rock layers under the lander, showing where each layer ends.',
    source: 'Knapmeyer-Endrun et al., Science, 2021',
  },
  {
    id: 'litho', name: 'Lithosphere', top: 40, bottom: 500, color: '#b8643f',
    depth: 'From the crust down to about 400 to 600 km',
    state: 'Solid, cold and rigid',
    made: 'The top of the mantle, iron-rich olivine rock, stuck to the crust as one stiff shell. Mars has no moving plates, so faults form inside this shell instead.',
    how: 'S-waves slowed down in a softer zone just beneath it, which marks where the rigid lid ends.',
    source: 'Khan et al., Science, 2021',
  },
  {
    id: 'mantle', name: 'Upper mantle', top: 500, bottom: 1000, color: '#94443a',
    depth: 'About 500 to 1,000 km',
    state: 'Solid rock that creeps very slowly',
    made: 'Olivine-rich rock (peridotite), with more iron than Earth\'s mantle.',
    how: 'Speeds of P- and S-waves from quakes at different distances.',
    source: 'Khan et al., Science, 2021',
  },
  {
    id: 'deep', name: 'Deep mantle', top: 1000, bottom: 1565, color: '#702f2c',
    depth: 'About 1,000 to 1,565 km',
    state: 'Solid',
    made: 'The same rock, but the pressure squeezes olivine into a denser mineral (wadsleyite) below about 1,000 km.',
    how: 'A sudden jump in seismic speed near 1,000 km depth.',
    source: 'Huang et al., PNAS, 2022',
  },
  {
    id: 'molten', name: 'Molten rock layer', top: 1565, bottom: 1715, color: '#ff7a1a',
    depth: 'About 1,565 to 1,715 km (around 150 km thick)',
    state: 'Liquid rock (magma)',
    made: 'Molten iron-rich silicate wrapped around the core, kept hot by radioactive elements.',
    how: 'Waves that crossed the core arrived at times that only fit if a liquid rock layer sits on top of it. This made the core look bigger in the first 2021 estimate.',
    source: 'Khan et al. and Samuel et al., Nature, 2023',
  },
  {
    id: 'outer', name: 'Liquid core', top: 1715, bottom: 2777, color: '#f2b442',
    depth: 'About 1,715 km down to the inner core (radius 1,650 to 1,675 km)',
    state: 'Liquid metal',
    made: 'Iron and nickel with 9 to 15% light elements: sulfur, carbon, oxygen and hydrogen. Density about 6.65 g/cm³.',
    how: 'S-waves echoed off its top, and P-waves travelled through it.',
    source: 'Khan et al., Nature, 2023',
  },
  {
    id: 'inner', name: 'Solid inner core', top: 2777, bottom: 3389.5, color: '#fff1c4',
    depth: 'The centre, about 613 km in radius',
    state: 'Solid metal',
    made: 'Iron alloy that has frozen out of the liquid core, with a different mix of light elements.',
    how: 'Two faint signals: waves that crossed the core twice (PKKP) and waves that bounced off the inner core (PKiKP).',
    source: 'Bi et al., Nature, 2025',
  },
];
