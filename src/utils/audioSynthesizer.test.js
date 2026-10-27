import { describe, it, expect } from 'vitest';
import { marsAudio, NASA_AUDIO_TRACKS } from './audioSynthesizer';

describe('NASA Martian Audio Engine & Tracks', () => {
  it('defines valid authentic NASA audio tracks with proper sources and metadata', () => {
    expect(NASA_AUDIO_TRACKS.wind_sol4).toBeDefined();
    expect(NASA_AUDIO_TRACKS.wind_sol4.src).toBe('/audio/nasa_perseverance_wind_sol4.mp3');
    expect(NASA_AUDIO_TRACKS.wind_sol4.sol).toBe(4);

    expect(NASA_AUDIO_TRACKS.wind_filtered).toBeDefined();
    expect(NASA_AUDIO_TRACKS.wind_filtered.src).toBe('/audio/nasa_perseverance_wind_filtered.ogg');

    expect(NASA_AUDIO_TRACKS.laser_sol12).toBeDefined();
    expect(NASA_AUDIO_TRACKS.laser_sol12.src).toBe('/audio/nasa_supercam_laser_sol12.mp3');
    expect(NASA_AUDIO_TRACKS.laser_sol12.sol).toBe(12);

    expect(NASA_AUDIO_TRACKS.marsquake_sol128).toBeDefined();
    expect(NASA_AUDIO_TRACKS.marsquake_sol128.src).toBe('/audio/nasa_insight_marsquake_sol128.mp4');
    expect(NASA_AUDIO_TRACKS.marsquake_sol128.sol).toBe(128);
  });

  it('provides playback methods on marsAudio singleton', () => {
    expect(typeof marsAudio.playNasaTrack).toBe('function');
    expect(typeof marsAudio.stopNasaTrack).toBe('function');
    expect(typeof marsAudio.toggleNasaTrack).toBe('function');
    expect(typeof marsAudio.isNasaTrackPlaying).toBe('function');
    expect(typeof marsAudio.setNasaTrackVolume).toBe('function');
    expect(typeof marsAudio.playLaserZap).toBe('function');
    expect(typeof marsAudio.playMarsquakeAudio).toBe('function');
  });

  it('handles volume and mute toggles gracefully', () => {
    marsAudio.setWindVolume(0.4);
    expect(marsAudio.windVol).toBe(0.4);

    marsAudio.setBreathVolume(0.08);
    expect(marsAudio.breathVol).toBe(0.08);

    marsAudio.setGeigerVolume(0.05);
    expect(marsAudio.geigerVol).toBe(0.05);
  });
});
