import { describe, expect, it } from 'vitest';
import { analyse, libsElements, paleoEnvironment, pearson, pixlPoint } from './scienceLab';

const flat = (v, n = 20) => Array.from({ length: n }, () => v);
const ramp = (n = 20) => Array.from({ length: n }, (_, i) => i);

function fakeData({ so3 = 20, mgo = 12, sio2 = 31, bands = [], fluorSnr = 50 } = {}) {
  const stat = (med) => ({ med, lo: med * 0.8, hi: med * 1.2, max: med * 1.5 });
  const keys = ['Na2O', 'MgO', 'Al2O3', 'SiO2', 'P2O5', 'SO3', 'Cl', 'K2O', 'CaO', 'TiO2', 'Cr2O3', 'MnO', 'FeO-T'];
  const med = { MgO: mgo, SiO2: sio2, SO3: so3, CaO: 9, 'FeO-T': 16, Al2O3: 4.6, Cl: 0.3, Na2O: 2 };
  return {
    libs: { points: [{ n: 1, lines: [{ nm: 393.4, el: 'Ca', h: 100 }, { nm: 279.6, el: 'Mg', h: 60 }, { nm: 777.4, el: 'O', h: 40 }, { nm: 288.2, el: 'Si', h: 30 }] }] },
    pixl: {
      n: 20, oxides: keys,
      stats: Object.fromEntries(keys.map((k) => [k, stat(med[k] ?? 0.1)])),
      v: Object.fromEntries(keys.map((k) => [k, k === 'SO3' || k === 'CaO' ? ramp() : flat(med[k] ?? 0.1)])),
    },
    sherloc: { n: 50, raman: { bands }, fluor: { bands: [{ name: 'a', lo: 275, hi: 300, snr: 5 }, { name: 'b', lo: 300, hi: 345, snr: fluorSnr }] } },
  };
}
const meta = { name: 'Test', rockType: 'Sulfate-rich sedimentary rock' };

describe('science lab analysis', () => {
  it('correlates series', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it('lists the elements of a LIBS point, strongest first, flagging air', () => {
    const els = libsElements(fakeData().libs.points[0]);
    expect(els.map((e) => e.el)).toEqual(['Ca', 'Mg', 'O', 'Si']);
    expect(els.find((e) => e.el === 'O').atmosphere).toBe(true);
    expect(els[0].mainNm).toBe(393.4);
  });

  it('reads sulfate salts from PIXL and ties them to calcium when the two rise together', () => {
    const a = analyse(meta, fakeData());
    const ev = a.evidence.find((e) => e.id === 'sulfate');
    expect(ev.level).toBe('strong');
    expect(ev.detail).toMatch(/calcium sulfate/);
    expect(a.minerals[0]).toBe('Calcium sulfate');
  });

  it('does not invent sulfates or olivine in a plain basalt', () => {
    const a = analyse({ name: 'B', rockType: 'Basaltic igneous rock' }, fakeData({ so3: 1.5, mgo: 6, sio2: 48 }));
    expect(a.evidence.find((e) => e.id === 'sulfate')).toBeUndefined();
    expect(a.evidence.find((e) => e.id === 'olivine')).toBeUndefined();
    expect(a.minerals).toContain('Pyroxene and feldspar (basalt minerals)');
  });

  it('calls magnesium-rich, silica-poor rock olivine', () => {
    const a = analyse({ name: 'O', rockType: 'Olivine-rich igneous rock' }, fakeData({ so3: 1, mgo: 24, sio2: 40 }));
    expect(a.evidence.find((e) => e.id === 'olivine').level).toBe('strong');
  });

  it('only reports Raman bands above the noise and never calls fluorescence a proof of organics', () => {
    const bands = [{ name: 'Carbonate', lo: 1080, hi: 1100, snr: 8, at: 1090 }, { name: 'Olivine', lo: 815, hi: 860, snr: 1.2, at: 820 }, { name: 'Water', lo: 3200, hi: 3650, snr: 3.5, at: 3400 }];
    const a = analyse(meta, fakeData({ bands }));
    expect(a.evidence.find((e) => e.id === 'raman-Carbonate').level).toBe('strong');
    expect(a.evidence.find((e) => e.id === 'raman-Water').level).toBe('possible');
    expect(a.evidence.find((e) => e.id === 'raman-Olivine')).toBeUndefined();
    const fl = a.evidence.find((e) => e.id === 'fluor');
    expect(fl.level).toBe('possible');
    expect(fl.detail).toMatch(/does not show/);
  });

  it('reads one PIXL point and handles a missing one', () => {
    const d = fakeData();
    expect(pixlPoint(d.pixl, 3).SO3).toBe(3);
    expect(pixlPoint(d.pixl, null)).toBe(null);
    expect(pixlPoint(d.pixl, -1)).toBe(null);
  });

  it('describes the water at three acidity ranges', () => {
    expect(paleoEnvironment(3).precipitates).toMatch(/Jarosite/);
    expect(paleoEnvironment(7).precipitates).toMatch(/Smectite/);
    expect(paleoEnvironment(9.5).precipitates).toMatch(/Serpentine/);
  });
});
