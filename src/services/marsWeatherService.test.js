import { describe, it, expect } from 'vitest';
import { normalizeRoverSol, parseRoverWeatherFeed } from './marsWeatherService';

describe('marsWeatherService', () => {
  const sampleRawSol = {
    id: '4746',
    terrestrial_date: '2026-08-25',
    sol: '4995',
    ls: '341',
    season: 'Month 12',
    min_temp: '-71',
    max_temp: '-5',
    pressure: '777',
    pressure_string: 'Higher',
    abs_humidity: '--',
    wind_speed: '5.2',
    wind_direction: 'ESE',
    atmo_opacity: 'Sunny',
    sunrise: '06:46',
    sunset: '18:51',
    local_uv_irradiance_index: 'Moderate',
    min_gts_temp: '-84',
    max_gts_temp: '4',
  };

  it('normalizes a raw NASA sol record into structured telemetry', () => {
    const normalized = normalizeRoverSol(sampleRawSol);
    expect(normalized).toBeDefined();
    expect(normalized.sol).toBe(4995);
    expect(normalized.terrestrialDate).toBe('2026-08-25');
    expect(normalized.temperature.min).toBe(-71);
    expect(normalized.temperature.max).toBe(-5);
    expect(normalized.temperature.avg).toBe(-38);
    expect(normalized.groundTemperature.min).toBe(-84);
    expect(normalized.groundTemperature.max).toBe(4);
    expect(normalized.pressure.value).toBe(777);
    expect(normalized.uvIndex).toBe('Moderate');
    expect(normalized.condition).toBe('Sunny');
    expect(normalized.isLiveDownlink).toBe(true);
  });

  it('parses and sorts an array of raw Sol records chronologically descending', () => {
    const rawArray = [
      { ...sampleRawSol, sol: '4990', min_temp: '-75', max_temp: '-8' },
      { ...sampleRawSol, sol: '4995', min_temp: '-71', max_temp: '-5' },
      { ...sampleRawSol, sol: '4992', min_temp: '-73', max_temp: '-6' },
      { sol: '4991', min_temp: '--', max_temp: '--' }, // Invalid sol should be filtered
    ];

    const parsed = parseRoverWeatherFeed(rawArray);
    expect(parsed.length).toBe(3);
    expect(parsed[0].sol).toBe(4995);
    expect(parsed[1].sol).toBe(4992);
    expect(parsed[2].sol).toBe(4990);
  });

  it('safely handles missing or incomplete fields without throwing', () => {
    const incomplete = {
      sol: '1000',
      min_temp: '-70',
      max_temp: '-10',
    };
    const normalized = normalizeRoverSol(incomplete);
    expect(normalized.sol).toBe(1000);
    expect(normalized.temperature.avg).toBe(-40);
    expect(normalized.pressure.value).toBe(750);
    expect(normalized.wind.speed).toBe(4.5);
  });
});
