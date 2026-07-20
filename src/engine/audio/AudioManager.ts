/**
 * All sound in the vertical slice is synthesized at runtime with the Web Audio API.
 * No external audio assets are bundled, so there is nothing to license — every
 * cue below (footsteps, wind, drones, stingers) is generated from oscillators
 * and filtered noise buffers.
 */
export class AudioManager {
  private ctx: AudioContext;
  private master: GainNode;
  private ambienceGain: GainNode;
  private windGain: GainNode;
  private windSource: AudioBufferSourceNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  constructor() {
    this.ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);

    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.value = 0.35;
    this.ambienceGain.connect(this.master);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windGain.connect(this.master);
  }

  async resume() {
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  private noiseBuffer(seconds = 2): AudioBuffer {
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  startWind(volume = 0.15) {
    if (this.windSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4);
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 300;
    filter.Q.value = 0.5;
    src.connect(filter).connect(this.windGain);
    this.windGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 1.5);
    src.start();
    this.windSource = src;
  }

  setWindIntensity(intensity: number) {
    // intensity 0..1, escalates target volume + filter frequency for the crash buildup
    this.windGain.gain.setTargetAtTime(
      0.05 + intensity * 0.6,
      this.ctx.currentTime,
      0.4,
    );
  }

  stopWind() {
    this.windSource?.stop();
    this.windSource = null;
  }

  startAmbience() {
    // Low sustained drone + slow filtered noise bed for the house interior.
    const drone = this.ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 55;
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.05;
    drone.connect(droneGain).connect(this.ambienceGain);
    drone.start();
    this.droneOsc = drone;
    this.droneGain = droneGain;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(6);
    noise.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    noise.connect(filter).connect(this.ambienceGain);
    noise.start();
  }

  /** One-shot creak/footstep style click built from filtered noise burst. */
  private noiseBurst(
    freq: number,
    q: number,
    duration: number,
    volume: number,
  ) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.3);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + duration,
    );
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(this.ctx.currentTime + duration);
  }

  footstep() {
    this.noiseBurst(180 + Math.random() * 60, 3, 0.12, 0.25);
  }

  woodCreak() {
    this.noiseBurst(220 + Math.random() * 400, 8, 0.6, 0.3);
  }

  doorCreak() {
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      90,
      this.ctx.currentTime + 1.2,
    );
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + 1.2,
    );
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.3);
  }

  distantThud() {
    this.noiseBurst(80, 1.5, 0.5, 0.4);
  }

  whisper() {
    // Band-limited noise shaped roughly like a hushed voice, non-verbal.
    this.noiseBurst(1200, 6, 0.9, 0.12);
  }

  radioStatic() {
    this.noiseBurst(3500, 1.2, 0.4, 0.2);
  }

  /** Cardiac monitor blip; pitch/rate driven by the caller from the current BPM. */
  monitorBeep(urgent = false) {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = urgent ? 1100 : 880;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(urgent ? 0.14 : 0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.13);
  }

  stinger() {
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(60, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      20,
      this.ctx.currentTime + 1.5,
    );
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + 1.5,
    );
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.6);
  }
}
