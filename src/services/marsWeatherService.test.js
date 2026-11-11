import { describe, it, expect } from 'vitest';
import { normalizeRoverSol, parseRoverWeatherFeed, WEATHER_STATIONS } from './marsWeatherService';

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

  it('exposes authentic NASA metadata for all three surface stations', () => {
    const { WEATHER_STATIONS } = require('./marsWeatherService');
    expect(WEATHER_STATIONS.perseverance).toBeDefined();
    expect(WEATHER_STATIONS.curiosity).toBeDefined();
    expect(WEATHER_STATIONS.insight).toBeDefined();

    expect(WEATHER_STATIONS.perseverance.elevationM).toBe(-2500);
    expect(WEATHER_STATIONS.curiosity.elevationM).toBe(-4400);
    expect(WEATHER_STATIONS.insight.elevationM).toBe(-2613);

    expect(WEATHER_STATIONS.curiosity.elevationM).toBeLessThan(WEATHER_STATIONS.perseverance.elevationM);
  });

  it('normalizes Perseverance MEDA sol with relative humidity and winds', () => {
    const rawM20 = {
      sol: '1200',
      earth_date: '2024-07-04',
      ls: '110',
      season: 'Month 4',
      air_temp_min: -78,
      air_temp_max: -14,
      pressure_pa: 735,
      relative_humidity_pct: 3.4,
      wind_speed_mps: 6.8,
      condition: 'Clear',
    };
    const normalized = normalizeRoverSol(rawM20, 'perseverance');
    expect(normalized.stationId).toBe('perseverance');
    expect(normalized.relativeHumidityPct).toBe(3.4);
    expect(normalized.elevationM).toBe(-2500);
    expect(normalized.pressure.value).toBe(735);
    expect(normalized.wind.speed).toBe(6.8);
  });

  it('normalizes InSight APSS sol with convective dust devil vortex drop', () => {
    const rawInsight = {
      sol: '850',
      earth_date: '2021-04-18',
      ls: '25',
      season: 'Month 1',
      air_temp_min: -92,
      air_temp_max: -18,
      pressure_pa: 728,
      dust_devils_detected: 3,
      max_vortex_delta_p_pa: -4.8,
    };
    const normalized = normalizeRoverSol(rawInsight, 'insight');
    expect(normalized.stationId).toBe('insight');
    expect(normalized.dustDevilsDetected).toBe(3);
    expect(normalized.vortexDeltaPPa).toBe(-4.8);
    expect(normalized.elevationM).toBe(-2613);
  });

});
