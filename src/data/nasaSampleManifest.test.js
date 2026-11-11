import { describe, expect, it } from 'vitest';
import { NASA_MSR_MANIFEST, TOTAL_MSR_TUBES, getMsrManifestStats } from './nasaSampleManifest';

describe('NASA Mars 2020 Sample Return (MSR) Manifest', () => {
  it('contains all 24 officially cataloged NASA sample tubes', () => {
    expect(NASA_MSR_MANIFEST).toHaveLength(24);
  });

  it('defines the 38-sample tube limit from mission specifications', () => {
    expect(TOTAL_MSR_TUBES).toBe(38);
  });

  it('verifies exactly 10 sample tubes were deposited at the Three Forks Sample Depot', () => {
    const threeForks = NASA_MSR_MANIFEST.filter((t) => t.depotLocation === 'Three Forks Depot');
    expect(threeForks).toHaveLength(10);

    const depotNames = threeForks.map((t) => t.name);
    expect(depotNames).toContain('Roubion');
    expect(depotNames).toContain('Montdenier');
    expect(depotNames).toContain('Coulettes');
    expect(depotNames).toContain('Malay');
    expect(depotNames).toContain('Atsah');
    expect(depotNames).toContain('Skyland');
    expect(depotNames).toContain('Bearwallow');
    expect(depotNames).toContain('Mageik');
    expect(depotNames).toContain('Crosswind Lake');
    expect(depotNames).toContain('Amalik Witness Blank');
  });

  it('verifies the 14 prime cores retained in the Onboard Rover Belly Cache', () => {
    const onboard = NASA_MSR_MANIFEST.filter((t) => t.depotLocation === 'Onboard Rover Belly Cache');
    expect(onboard).toHaveLength(14);

    const onboardNames = onboard.map((t) => t.name);
    expect(onboardNames).toContain('Montagnac');
    expect(onboardNames).toContain('Salette');
    expect(onboardNames).toContain('Robine');
    expect(onboardNames).toContain('Ha\'ahóni');
    expect(onboardNames).toContain('Swift Run');
    expect(onboardNames).toContain('Hazeltop');
    expect(onboardNames).toContain('Shuyak');
    expect(onboardNames).toContain('Kukaklek');
    expect(onboardNames).toContain('Athene Mountain');
    expect(onboardNames).toContain('Otis Peak');
    expect(onboardNames).toContain('Pelican Point');
    expect(onboardNames).toContain('Bunsen Peak');
    expect(onboardNames).toContain('Silver Lake');
    expect(onboardNames).toContain('Cheyava Falls');
  });

  it('validates physical metadata: length, mass, sol, and NASA hardware IDs', () => {
    NASA_MSR_MANIFEST.forEach((sample) => {
      expect(sample.tubeNumber).toBeGreaterThanOrEqual(1);
      expect(sample.tubeNumber).toBeLessThanOrEqual(TOTAL_MSR_TUBES);
      expect(sample.serialId).toMatch(/^M2020-/);
      expect(sample.nasaHardwareId).toBeDefined();
      expect(sample.name).toBeTruthy();
      expect(sample.target).toBeTruthy();
      expect(sample.formation).toBeTruthy();
      expect(sample.sol).toBeGreaterThan(0);
      expect(sample.coreLengthMm).toBeGreaterThanOrEqual(0);
      expect(sample.coreMassG).toBeGreaterThanOrEqual(0);
      expect(sample.pdsUrl).toContain('pds-geosciences.wustl.edu');
    });
  });

  it('computes accurate manifest aggregate statistics', () => {
    const stats = getMsrManifestStats(NASA_MSR_MANIFEST);
    expect(stats.totalTubes).toBe(38);
    expect(stats.sealedCount).toBe(24);
    expect(stats.openTubes).toBe(14);
    expect(stats.threeForksCount).toBe(10);
    expect(stats.onboardCount).toBe(14);
    expect(stats.totalSealedMassG).toBeGreaterThan(150);
    expect(stats.totalCoredLengthMm).toBeGreaterThan(1000);
    expect(stats.sedimentaryCount).toBeGreaterThanOrEqual(10);
    expect(stats.igneousCount).toBeGreaterThanOrEqual(8);
  });

  it('confirms Mageik as the longest continuous rock core drilled', () => {
    const mageik = NASA_MSR_MANIFEST.find((t) => t.name === 'Mageik');
    expect(mageik).toBeDefined();
    expect(mageik.coreLengthMm).toBe(73.6);
  });

  it('confirms Cheyava Falls as the high-priority biosignature leopard-spots core', () => {
    const cheyava = NASA_MSR_MANIFEST.find((t) => t.name === 'Cheyava Falls');
    expect(cheyava).toBeDefined();
    expect(cheyava.significance).toContain('BIOSIGNATURE');
    expect(cheyava.minerals).toContain('Vivianite (Iron Phosphate)');
  });
});
