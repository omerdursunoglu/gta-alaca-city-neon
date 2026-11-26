/**
 * Procedural Web Audio API Sound Synthesizer
 * Generates punches, knife slashes, pistol/SMG shots, footsteps,
 * Turkish street cat meows/startles, and ambient Anatolian wind.
 */

export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.windGain = null;
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
    this.master.gain.value = this.muted ? 0 : 0.75;
    this.master.connect(this.ctx.destination);

    // Pre-generate 2 seconds of white noise
    const length = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this._startAmbientWind();
    this.initialized = true;
  }

  setMuted(mute) {
    this.muted = mute;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(mute ? 0 : 0.75, this.ctx.currentTime, 0.04);
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

    // Slow wind modulation LFO
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.045;

    src.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.master);

    src.start();
    lfo.start();
  }

  playPunch(hit = false) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // Air whoosh
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

    if (hit) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now + 0.02);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.55, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + 0.02);
      osc.stop(now + 0.19);
    }
  }

  playKnifeSlash(hit = false) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(6400, now + 0.08);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.13);

    // Metallic ring
    const ring = this.ctx.createOscillator();
    ring.type = 'triangle';
    ring.frequency.setValueAtTime(hit ? 1950 : 2850, now);
    ring.frequency.exponentialRampToValueAtTime(1100, now + 0.11);
    const rGain = this.ctx.createGain();
    rGain.gain.setValueAtTime(hit ? 0.16 : 0.07, now);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    ring.connect(rGain);
    rGain.connect(this.master);
    ring.start(now);
    ring.stop(now + 0.12);
  }

  playPistol() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // Sharp crack noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1750, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.22);
    filter.Q.value = 0.7;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.7, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.26);

    // Low punch
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.09);
    const oGain = this.ctx.createGain();
    oGain.gain.setValueAtTime(0.42, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(oGain);
    oGain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.11);

    // Street slapback echo
    const echo = this.ctx.createBufferSource();
    echo.buffer = this.noiseBuffer;
    const eFilter = this.ctx.createBiquadFilter();
    eFilter.type = 'lowpass';
    eFilter.frequency.value = 750;
    const eGain = this.ctx.createGain();
    eGain.gain.setValueAtTime(0.14, now + 0.11);
    eGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    echo.connect(eFilter);
    eFilter.connect(eGain);
    eGain.connect(this.master);
    echo.start(now + 0.11);
    echo.stop(now + 0.43);
  }

  playSMG() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100 + Math.random() * 350, now);
    filter.frequency.exponentialRampToValueAtTime(450, now + 0.11);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.13);

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.06);
    const oGain = this.ctx.createGain();
    oGain.gain.setValueAtTime(0.22, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(oGain);
    oGain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playReload() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [0, 0.18].forEach((offset, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i === 0 ? 640 : 920, now + offset);
      osc.frequency.exponentialRampToValueAtTime(280, now + offset + 0.05);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.16, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.055);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.06);
    });
  }

  playFootstep(surface = 'stone') {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = surface === 'wood' ? 520 : surface === 'grass' ? 950 : 780;

    const gain = this.ctx.createGain();
    const vol = surface === 'wood' ? 0.13 : 0.09;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.08);

    if (surface === 'wood') {
      const thud = this.ctx.createOscillator();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(115, now);
      thud.frequency.exponentialRampToValueAtTime(55, now + 0.06);
      const tGain = this.ctx.createGain();
      tGain.gain.setValueAtTime(0.11, now);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      thud.connect(tGain);
      tGain.connect(this.master);
      thud.start(now);
      thud.stop(now + 0.07);
    }
  }

  playCatMeow(pitchShift = 1.0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const base = 540 * pitchShift;
    osc.frequency.setValueAtTime(base * 0.85, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.32, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(base * 0.74, now + 0.42);

    const formant = this.ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(1100 * pitchShift, now);
    formant.frequency.linearRampToValueAtTime(1650 * pitchShift, now + 0.15);
    formant.frequency.linearRampToValueAtTime(950 * pitchShift, now + 0.42);
    formant.Q.value = 2.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(formant);
    formant.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  playCatHiss() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.25);
  }
}
