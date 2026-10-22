// Where regional dust storms on Mars most often start, from the storm records kept by orbiters since
// 1999 (MGS MOC, then MRO MARCI daily global maps): the three northern "storm tracks" that sweep south
// through Acidalia-Chryse, Utopia-Isidis and Arcadia-Amazonis, and the big southern basins and their
// rims. Radii are rough extents in degrees of arc.

export const DUST_STORM_REGIONS = [
  { id: 'acidalia', name: 'Acidalia–Chryse storm track', lat: 38, lon: -32, radiusDeg: 17 },
  { id: 'utopia', name: 'Utopia–Isidis storm track', lat: 32, lon: 100, radiusDeg: 17 },
  { id: 'arcadia', name: 'Arcadia–Amazonis storm track', lat: 30, lon: -155, radiusDeg: 15 },
  { id: 'hellas', name: 'Hellas basin', lat: -42.4, lon: 70.5, radiusDeg: 15 },
  { id: 'argyre', name: 'Argyre basin', lat: -49.7, lon: -43.4, radiusDeg: 11 },
  { id: 'noachis', name: 'Noachis Terra', lat: -45, lon: -10, radiusDeg: 11 },
];

/** Most regional and global storms happen in southern spring and summer, Ls 180-360. */
export const DUST_SEASON_LS = [180, 360];
