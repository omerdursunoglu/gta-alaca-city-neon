/**
 * Real CC0 Audio Sample Player + Web Audio API Fallback Synthesizer
 * Preloads real CC0 MP3 samples from ./assets/audio/ into decoded AudioBuffers
 * for zero-latency polyphonic playback, with procedural Web Audio fallback.
 */

const SOUND_MANIFEST = {
  cat_meow_1: './assets/audio/cat_meow_1.mp3',
  cat_meow_2: './assets/audio/cat_meow_2.mp3',
  cat_meow_3: './assets/audio/cat_meow_3.mp3',
  cat_hiss: './assets/audio/cat_hiss.mp3',
  pistol: './assets/audio/pistol.mp3',
  smg: './assets/audio/smg.mp3',
  reload: './assets/audio/reload.mp3',
  weapon_switch: './assets/audio/weapon_switch.mp3',
  punch_swing: './assets/audio/punch_swing.mp3',
  punch_hit: './assets/audio/punch_hit.mp3',
  knife_slash: './assets/audio/knife_slash.mp3',
  knife_hit: './assets/audio/knife_hit.mp3',
  step_stone_1: './assets/audio/step_stone_1.mp3',
  step_stone_2: './assets/audio/step_stone_2.mp3',
  step_wood_1: './assets/audio/step_wood_1.mp3',
  step_wood_2: './assets/audio/step_wood_2.mp3',
  step_grass_1: './assets/audio/step_grass_1.mp3',
  door_open: './assets/audio/door_open.mp3',
  door_close: './assets/audio/door_close.mp3',
  ambient_wind: './assets/audio/ambient_wind.mp3',
  ricochet: './assets/audio/ricochet.mp3',
  jump: './assets/audio/jump.mp3',
  cash_pickup: './assets/audio/cash_pickup.mp3',
};

export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.windGain = null;
    this.realWindSource = null;
    this.buffers = new Map();
    this.stepFlip = 0;
    this.muted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);

    // Fallback noise buffer while real MP3s decode
    const length = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this._startAmbientWind();
    this._preloadAllSamples();
    this.initialized = true;
  }

  async _preloadAllSamples() {
    const entries = Object.entries(SOUND_MANIFEST);
    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const arr = await res.arrayBuffer();
          const decoded = await this.ctx.decodeAudioData(arr);
          this.buffers.set(key, decoded);
          if (key === 'ambient_wind') {
            this._switchToRealAmbient(decoded);
          }
        } catch {
          // Keep procedural synth fallback if a fetch/decode fails
        }
      })
    );
  }

  _switchToRealAmbient(buffer) {
    if (!this.ctx || !this.master || this.realWindSource) return;
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.4);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 1.2);

    src.connect(gain);
    gain.connect(this.master);
    src.start();
    this.realWindSource = src;
  }

  _playBuffer(key, { volume = 0.7, rateMin = 0.96, rateMax = 1.04 } = {}) {
    if (!this.ctx || this.muted) return false;
    const buf = this.buffers.get(key);
    if (!buf) return false;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rateMin + Math.random() * (rateMax - rateMin);

    const gain = this.ctx.createGain();
    gain.gain.value = volume;

    src.connect(gain);
    gain.connect(this.master);
    src.start();
    return true;
  }

  setMuted(mute) {
    this.muted = mute;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(mute ? 0 : 0.8, this.ctx.currentTime, 0.04);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _startAmbientWind() {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 1.6;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.035;

    src.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.master);

    src.start();
    lfo.start();
  }

  playPunch(hit = false) {
    if (!this.ctx || this.muted) return;
    const swung = this._playBuffer('punch_swing', { volume: 0.55, rateMin: 0.92, rateMax: 1.12 });
    if (hit) {
      const impacted = this._playBuffer('punch_hit', { volume: 0.78, rateMin: 0.9, rateMax: 1.1 });
      if (swung && impacted) return;
    } else if (swung) {
      return;
    }

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(170, now + 0.14);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.22, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.16);
  }

  playKnifeSlash(hit = false) {
    if (!this.ctx || this.muted) return;
    const slashed = this._playBuffer('knife_slash', { volume: 0.65, rateMin: 0.94, rateMax: 1.1 });
    if (hit) {
      const hitPlayed = this._playBuffer('knife_hit', { volume: 0.72, rateMin: 0.92, rateMax: 1.08 });
      if (slashed && hitPlayed) return;
    } else if (slashed) {
      return;
    }

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2200, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.13);
  }

  playPistol() {
    if (!this.ctx || this.muted) return;
    if (this._playBuffer('pistol', { volume: 0.85, rateMin: 0.95, rateMax: 1.05 })) return;

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1750, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.22);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.7, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.26);
  }

  playSMG() {
    if (!this.ctx || this.muted) return;
    if (this._playBuffer('smg', { volume: 0.62, rateMin: 0.96, rateMax: 1.08 })) return;

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100 + Math.random() * 350, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.13);
  }

  playReload() {
    if (!this.ctx || this.muted) return;
    if (this._playBuffer('reload', { volume: 0.68, rateMin: 0.96, rateMax: 1.04 })) return;
  }

  playWeaponSwitch() {
    if (!this.ctx || this.muted) return;
    this._playBuffer('weapon_switch', { volume: 0.52, rateMin: 0.95, rateMax: 1.05 });
  }

  playRicochet() {
    if (!this.ctx || this.muted) return;
    this._playBuffer('ricochet', { volume: 0.42, rateMin: 0.88, rateMax: 1.15 });
  }

  playCashPickup() {
    if (!this.ctx || this.muted) return;
    this._playBuffer('cash_pickup', { volume: 0.55, rateMin: 0.97, rateMax: 1.05 });
  }

  playJump() {
    if (!this.ctx || this.muted) return;
    this._playBuffer('jump', { volume: 0.45, rateMin: 0.92, rateMax: 1.08 });
  }

  playFootstep(surface = 'stone') {
    if (!this.ctx || this.muted) return;
    this.stepFlip = (this.stepFlip + 1) % 2;
    let key = this.stepFlip === 0 ? 'step_stone_1' : 'step_stone_2';
    if (surface === 'wood') key = this.stepFlip === 0 ? 'step_wood_1' : 'step_wood_2';
    else if (surface === 'grass') key = 'step_grass_1';

    if (this._playBuffer(key, { volume: surface === 'wood' ? 0.36 : 0.28, rateMin: 0.9, rateMax: 1.1 })) {
      return;
    }

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = surface === 'wood' ? 520 : 780;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.08);
  }

  playCatMeow(pitchShift = 1.0) {
    if (!this.ctx || this.muted) return;
    const idx = 1 + Math.floor(Math.random() * 3);
    if (
      this._playBuffer(`cat_meow_${idx}`, {
        volume: 0.65,
        rateMin: pitchShift * 0.94,
        rateMax: pitchShift * 1.06,
      })
    ) {
      return;
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const base = 540 * pitchShift;
    osc.frequency.setValueAtTime(base * 0.85, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.32, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(base * 0.74, now + 0.42);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  playCatHiss() {
    if (!this.ctx || this.muted) return;
    if (this._playBuffer('cat_hiss', { volume: 0.62, rateMin: 1.04, rateMax: 1.18 })) return;
  }

  playDoorToggle(opening = true) {
    if (!this.ctx || this.muted) return;
    const key = opening ? 'door_open' : 'door_close';
    if (this._playBuffer(key, { volume: 0.72, rateMin: 0.95, rateMax: 1.05 })) return;
  }
}
