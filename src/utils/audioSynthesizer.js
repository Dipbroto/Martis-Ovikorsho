// Martian Web Audio API Synthesizer & NASA Planetary Audio Engine
// Generates authentic procedural sounds & streams real acoustic recordings from NASA Perseverance and InSight

export const NASA_AUDIO_TRACKS = {
  wind_sol4: {
    id: 'wind_sol4',
    title: 'Perseverance Wind (Sol 4)',
    instrument: 'SuperCam Acoustic Microphone',
    spacecraft: 'Perseverance (Mars 2020)',
    site: 'Jezero Crater Paleolake',
    sol: 4,
    date: 'Feb 22, 2021',
    description: 'First raw acoustic recording of Martian wind ever captured by a surface microphone.',
    src: '/audio/nasa_perseverance_wind_sol4.mp3',
    loop: true,
    defaultVol: 0.7,
  },
  wind_filtered: {
    id: 'wind_filtered',
    title: 'Filtered Martian Breeze',
    instrument: 'SuperCam Microphone (Filtered)',
    spacecraft: 'Perseverance (Mars 2020)',
    site: 'Jezero Crater Paleolake',
    sol: 4,
    date: 'Feb 22, 2021',
    description: 'Rover mechanical noise subtracted, highlighting the thin 0.01-bar carbon dioxide breeze.',
    src: '/audio/nasa_perseverance_wind_filtered.ogg',
    loop: true,
    defaultVol: 0.65,
  },
  laser_sol12: {
    id: 'laser_sol12',
    title: 'SuperCam Laser Rock Zap',
    instrument: 'SuperCam LIBS Pulsed Laser',
    spacecraft: 'Perseverance (Mars 2020)',
    site: 'Target rock "Máaz", Jezero',
    sol: 12,
    date: 'March 2, 2021',
    description: 'Acoustic clicks of 30 pulsed laser shots ionizing rock surface 3.1 m away into optical plasma.',
    src: '/audio/nasa_supercam_laser_sol12.mp3',
    loop: false,
    defaultVol: 0.85,
  },
  marsquake_sol128: {
    id: 'marsquake_sol128',
    title: 'InSight Sol 128 Marsquake',
    instrument: 'SEIS Seismometer (VBB & SP)',
    spacecraft: 'InSight Lander',
    site: 'Elysium Planitia',
    sol: 128,
    date: 'April 6, 2019',
    description: 'First seismic event recorded from inside Mars, sped up 60× into audible range.',
    src: '/audio/nasa_insight_marsquake_sol128.mp4',
    loop: false,
    defaultVol: 0.9,
  },
};

class MarsAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;
    this.isMuted = true;
    this.masterGain = null;
    this.analyser = null;

    // Wind nodes
    this.windNode = null;
    this.windFilter = null;
    this.windGain = null;
    this.windVol = 0.25;

    // Breathing nodes & intervals
    this.breathGain = null;
    this.breathTimer = null;
    this.breathVol = 0.04;

    // Geiger timer
    this.geigerTimer = null;
    this.geigerVol = 0.06;

    // NASA Acoustic Audio Elements & Web Audio Nodes
    this.nasaElements = {};
    this.nasaSources = {};
    this.nasaGains = {};
    this.activeNasaTracks = new Set();
  }

  init() {
    if (this.isInitialized && this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.isInitialized = true;
      this.setupWindGenerator();
      this.setupRespirator();
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  setupWindGenerator() {
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    this.windNode = this.ctx.createBufferSource();
    this.windNode.buffer = noiseBuffer;
    this.windNode.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(this.isMuted ? 0 : this.windVol, this.ctx.currentTime);

    this.windNode.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    this.windNode.start(0);
    this.modulateWind();
  }

  modulateWind() {
    if (!this.ctx || !this.windFilter) return;
    const now = this.ctx.currentTime;
    const targetFreq = 180 + Math.random() * 220;
    const duration = 2 + Math.random() * 3;
    this.windFilter.frequency.linearRampToValueAtTime(targetFreq, now + duration);
    setTimeout(() => this.modulateWind(), duration * 1000);
  }

  setupRespirator() {
    if (!this.ctx) return;

    this.breathGain = this.ctx.createGain();
    this.breathGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.breathGain.connect(this.masterGain);

    const runBreathCycle = () => {
      if (!this.isMuted && this.ctx && this.ctx.state === 'running') {
        const now = this.ctx.currentTime;
        this.createBreathingPuff(now, 1.8, this.breathVol, 380);
        this.createBreathingPuff(now + 2.3, 1.4, this.breathVol * 0.75, 260);
      }
      this.breathTimer = setTimeout(runBreathCycle, 5200);
    };

    runBreathCycle();
  }

  createBreathingPuff(startTime, duration, peakVol, freq) {
    if (!this.ctx) return;
    const osc = this.ctx.createBufferSource();
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.2;
    }
    osc.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, startTime);
    filter.Q.setValueAtTime(3.0, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakVol, startTime + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // ==========================================================
  // REAL NASA ACOUSTIC AUDIO ENGINE (PERSEVERANCE & INSIGHT)
  // ==========================================================

  getOrCreateNasaAudioElement(trackId) {
    if (typeof window === 'undefined') return null;
    if (!this.nasaElements[trackId]) {
      const track = NASA_AUDIO_TRACKS[trackId];
      if (!track) return null;

      const audio = new Audio(track.src);
      audio.loop = !!track.loop;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';

      // Connect to Web Audio graph if available so FFT visualizer picks it up
      if (this.ctx) {
        try {
          const source = this.ctx.createMediaElementSource(audio);
          const trackGain = this.ctx.createGain();
          trackGain.gain.setValueAtTime(track.defaultVol || 0.6, this.ctx.currentTime);
          source.connect(trackGain);
          trackGain.connect(this.masterGain);

          this.nasaSources[trackId] = source;
          this.nasaGains[trackId] = trackGain;
        } catch (e) {
          console.warn('Could not connect media element source:', e);
        }
      }

      audio.addEventListener('ended', () => {
        if (!track.loop) {
          this.activeNasaTracks.delete(trackId);
        }
      });

      this.nasaElements[trackId] = audio;
    }
    return this.nasaElements[trackId];
  }

  playNasaTrack(trackId, options = {}) {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const audio = this.getOrCreateNasaAudioElement(trackId);
    if (!audio) return false;

    const track = NASA_AUDIO_TRACKS[trackId];
    if (options.loop !== undefined) audio.loop = options.loop;
    audio.currentTime = 0;

    const vol = options.volume ?? track?.defaultVol ?? 0.6;
    if (this.nasaGains[trackId] && this.ctx) {
      this.nasaGains[trackId].gain.setValueAtTime(vol, this.ctx.currentTime);
    } else {
      audio.volume = vol;
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.activeNasaTracks.add(trackId);
        })
        .catch((err) => {
          console.warn('NASA audio play prevented:', err);
        });
    }

    return true;
  }

  stopNasaTrack(trackId) {
    const audio = this.nasaElements[trackId];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      this.activeNasaTracks.delete(trackId);
    }
  }

  toggleNasaTrack(trackId) {
    if (this.isNasaTrackPlaying(trackId)) {
      this.stopNasaTrack(trackId);
      return false;
    } else {
      this.playNasaTrack(trackId);
      return true;
    }
  }

  isNasaTrackPlaying(trackId) {
    const audio = this.nasaElements[trackId];
    return audio ? !audio.paused && !audio.ended : false;
  }

  setNasaTrackVolume(trackId, val) {
    const v = Math.max(0, Math.min(1, val));
    if (this.nasaGains[trackId] && this.ctx) {
      this.nasaGains[trackId].gain.setValueAtTime(v, this.ctx.currentTime);
    }
    const audio = this.nasaElements[trackId];
    if (audio) audio.volume = v;
  }

  stopAllNasaTracks() {
    Object.keys(this.nasaElements).forEach((id) => this.stopNasaTrack(id));
    this.activeNasaTracks.clear();
  }

  // ==========================================================
  // INSTRUMENTS & TELEMETRY SOUNDS
  // ==========================================================

  playQuindarTone(isIntro = true) {
    if (this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      const freq = isIntro ? 2525 : 2475;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Error playing tone:', e);
    }
  }

  playGeigerClick() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createBufferSource();
      const buf = this.ctx.createBuffer(1, 100, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < 100; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      osc.buffer = buf;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.geigerVol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
    } catch (e) { /* ignore */ }
  }

  startGeigerLoop(clicksPerSec = 2) {
    this.stopGeigerLoop();
    const trigger = () => {
      this.playGeigerClick();
      const delay = (1000 / clicksPerSec) * (0.4 + Math.random() * 1.2);
      this.geigerTimer = setTimeout(trigger, delay);
    };
    trigger();
  }

  stopGeigerLoop() {
    if (this.geigerTimer) {
      clearTimeout(this.geigerTimer);
      this.geigerTimer = null;
    }
  }

  toggleMute() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMuted = !this.isMuted;
    if (this.windGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.windGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : this.windVol, now + 0.5);
    }

    if (!this.isMuted) {
      this.playQuindarTone(true);
      this.startGeigerLoop(1.5);
    } else {
      this.stopGeigerLoop();
      this.stopAllNasaTracks();
    }

    return !this.isMuted;
  }

  setVolume(val) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime);
    }
  }

  setWindVolume(val) {
    this.windVol = val;
    if (this.windGain && this.ctx && !this.isMuted) {
      this.windGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  setBreathVolume(val) {
    this.breathVol = val;
  }

  setGeigerVolume(val) {
    this.geigerVol = val;
  }

  playUiClick(pitch = 880) {
    if (!this.ctx) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, now + 0.04);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) { /* ignore */ }
  }

  playUiHover() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.02);
    } catch (e) { /* ignore */ }
  }

  playUiSwoosh() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);

      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) { /* ignore */ }
  }

  playSuccessChime() {
    if (!this.ctx) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      [587.33, 880].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.05, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.3);
      });
    } catch (e) { /* ignore */ }
  }

  playLaserZap() {
    if (!this.ctx) this.init();
    if (!this.ctx || this.isMuted) return;

    // Trigger authentic NASA SuperCam laser audio
    this.playNasaTrack('laser_sol12');

    // Procedural laser tonal sweep as backup / layer
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(3200, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) { /* ignore */ }
  }

  playMarsquakeAudio() {
    if (!this.ctx) this.init();
    if (!this.ctx || this.isMuted) return;
    this.playNasaTrack('marsquake_sol128');
  }

  playSampleSeal() {
    if (!this.ctx) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(340, now + 0.15);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.22);

      setTimeout(() => {
        this.playSuccessChime();
      }, 160);
    } catch (e) { /* ignore */ }
  }

  playPlasmaForge() {
    if (!this.ctx) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(60, now);
      osc1.frequency.exponentialRampToValueAtTime(140, now + 0.35);
      osc1.frequency.exponentialRampToValueAtTime(80, now + 0.7);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(now);
      osc1.stop(now + 0.7);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2400, now);
      osc2.frequency.linearRampToValueAtTime(4200, now + 0.2);
      osc2.frequency.exponentialRampToValueAtTime(800, now + 0.5);
      gain2.gain.setValueAtTime(0.04, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(now);
      osc2.stop(now + 0.5);

      setTimeout(() => {
        this.playSuccessChime();
      }, 500);
    } catch (e) { /* ignore */ }
  }

  getFrequencyData(array) {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(array);
    }
  }
}

export const marsAudio = new MarsAudioSynthesizer();

export const playUiClick = () => marsAudio.playUiClick();
export const playUiHover = () => marsAudio.playUiHover();
export const playUiSwoosh = () => marsAudio.playUiSwoosh();
export const playSuccessChime = () => marsAudio.playSuccessChime();
export const playLaserZap = () => marsAudio.playLaserZap();
export const playMarsquakeAudio = () => marsAudio.playMarsquakeAudio();
export const playSampleSeal = () => marsAudio.playSampleSeal();
export const playPlasmaForge = () => marsAudio.playPlasmaForge();
