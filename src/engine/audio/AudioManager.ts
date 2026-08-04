/**
 * All sound is synthesized at runtime with the Web Audio API — oscillators
 * and filtered noise buffers only. No external audio assets are bundled, so
 * there is nothing to license (see ASSETS.md).
 *
 * Silence is the primary horror tool per the brief: most methods here are
 * one-shots the scene fires sparingly, and the beds (rain, ambience,
 * heartbeat, breathing) all expose intensity controls so the scene can pull
 * everything down to near-silence on purpose.
 */
export class AudioManager {
  private ctx: AudioContext;
  private master: GainNode;
  private ambienceGain: GainNode;
  private windGain: GainNode;
  private rainGain: GainNode;
  private breathGain: GainNode;
  private windSource: AudioBufferSourceNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private breathSource: AudioBufferSourceNode | null = null;
  private fridgeNodes: { osc: OscillatorNode; gain: GainNode } | null = null;

  private heartbeatTimer: number | null = null;
  private heartbeatBpm = 0;
  private secondHeartbeatOffset = 0; // >0 enables an offset echo beat

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

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.0;
    this.rainGain.connect(this.master);

    this.breathGain = this.ctx.createGain();
    this.breathGain.gain.value = 0.0;
    this.breathGain.connect(this.master);
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

  // ---------- beds ----------

  /** Heavy rain: broadband noise, high-passed so it hisses rather than rumbles. */
  startRain(volume = 0.22) {
    if (this.rainSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(5);
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    src.connect(filter).connect(this.rainGain);
    this.rainGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 1.2);
    src.start();
    this.rainSource = src;
  }

  /** 0..1 — used to muffle rain when moving indoors without stopping it. */
  setRainIntensity(intensity: number) {
    this.rainGain.gain.setTargetAtTime(
      intensity * 0.25,
      this.ctx.currentTime,
      0.6,
    );
  }

  stopRain() {
    this.rainSource?.stop();
    this.rainSource = null;
  }

  /**
   * Thunder at a given loudness (0..~0.6). Distant storms are quieter,
   * longer, and lose their initial crack; close ones snap. The caller
   * derives volume + delay from the same storm distance so light and
   * sound stay physically consistent.
   */
  thunder(volume = 0.5) {
    const close = volume > 0.35;
    if (close) this.noiseBurst(2400, 1, 0.08, volume * 0.5);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(3.5);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = close ? 140 : 80;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + (close ? 2.6 : 3.5),
    );
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(this.ctx.currentTime + 3.6);
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
    // Low sustained drone + slow filtered noise bed for interiors.
    const drone = this.ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 55;
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.05;
    drone.connect(droneGain).connect(this.ambienceGain);
    drone.start();

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(6);
    noise.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    noise.connect(filter).connect(this.ambienceGain);
    noise.start();
  }

  /** Pull the whole ambient bed down/up — for the "house goes silent" beats. */
  setAmbienceLevel(level: number) {
    this.ambienceGain.gain.setTargetAtTime(
      0.35 * level,
      this.ctx.currentTime,
      0.8,
    );
  }

  /** Marcus's breathing: looped shaped noise whose level tracks exertion/fear. */
  setBreathIntensity(intensity: number) {
    if (!this.breathSource) {
      const src = this.ctx.createBufferSource();
      const seconds = 3.2;
      const buffer = this.noiseBuffer(seconds);
      // Amplitude-shape the noise into inhale/exhale swells.
      const data = buffer.getChannelData(0);
      const rate = this.ctx.sampleRate;
      for (let i = 0; i < data.length; i++) {
        const phase = (i / rate) % 1.6; // one breath cycle per 1.6s
        const env = Math.pow(Math.sin((phase / 1.6) * Math.PI), 2);
        data[i] *= env;
      }
      src.buffer = buffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 500;
      filter.Q.value = 0.8;
      src.connect(filter).connect(this.breathGain);
      src.start();
      this.breathSource = src;
    }
    // Quiet below ~40% exertion so calm walking is silent.
    const level = Math.max(0, intensity - 0.4) / 0.6;
    this.breathGain.gain.setTargetAtTime(
      level * 0.16,
      this.ctx.currentTime,
      0.5,
    );
  }

  /**
   * The kitchen fridge hum — deliberately a few cents off a clean pitch, per
   * the brief. Runs only while the player is in the kitchen zone.
   */
  startFridge() {
    if (this.fridgeNodes) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 118.7; // just noticeably flat of ~120Hz
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 1);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start();
    this.fridgeNodes = { osc, gain };
  }

  stopFridge() {
    if (!this.fridgeNodes) return;
    const { osc, gain } = this.fridgeNodes;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
    osc.stop(this.ctx.currentTime + 1.5);
    this.fridgeNodes = null;
  }

  // ---------- heartbeat ----------

  private heartThump(volume: number, pitch = 55) {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      pitch * 0.6,
      this.ctx.currentTime + 0.12,
    );
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  /**
   * Start/adjust the looping heartbeat (lub-dub). bpm <= 0 stops it.
   * Used during pulse checks and high-tension stretches.
   */
  setHeartbeat(bpm: number, volume = 0.2) {
    this.heartbeatBpm = bpm;
    if (this.heartbeatTimer !== null) {
      window.clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (bpm <= 0) return;
    const beat = () => {
      if (this.heartbeatBpm <= 0) return;
      this.heartThump(volume);
      window.setTimeout(() => this.heartThump(volume * 0.7), 180);
      if (this.secondHeartbeatOffset > 0) {
        // The wrong, second heartbeat: same rhythm, offset, thinner pitch.
        window.setTimeout(
          () => this.heartThump(volume * 0.5, 82),
          this.secondHeartbeatOffset,
        );
      }
      this.heartbeatTimer = window.setTimeout(
        beat,
        60000 / this.heartbeatBpm,
      );
    };
    beat();
  }

  /** Enable/disable the offset second heartbeat (ms offset; 0 = off). */
  setSecondHeartbeat(offsetMs: number) {
    this.secondHeartbeatOffset = offsetMs;
  }

  // ---------- one-shots ----------

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

  footstep(running = false) {
    this.noiseBurst(
      180 + Math.random() * 60,
      3,
      running ? 0.15 : 0.12,
      running ? 0.34 : 0.25,
    );
  }

  woodCreak() {
    this.noiseBurst(220 + Math.random() * 400, 8, 0.6, 0.3);
  }

  doorCreak() {
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 1.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
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

  /** Rotary phone bell — two quick strikes. */
  phoneRing() {
    for (const delay of [0, 90]) {
      window.setTimeout(() => {
        const osc = this.ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = 1400;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          this.ctx.currentTime + 0.25,
        );
        osc.connect(gain).connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.26);
      }, delay);
    }
  }

  stinger() {
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(60, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 1.5);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.6);
  }

  /** Short, sharp scare sting — brighter and faster than the low stinger. */
  sting() {
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      180,
      this.ctx.currentTime + 0.35,
    );
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + 0.4,
    );
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  /** Ambulance engine turning over and settling to idle (Ending 1). */
  engineStart() {
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(30, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(85, this.ctx.currentTime + 0.9);
    osc.frequency.linearRampToValueAtTime(55, this.ctx.currentTime + 1.6);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.4);
    gain.gain.setTargetAtTime(0.07, this.ctx.currentTime + 1.6, 0.5);
    gain.gain.setTargetAtTime(0, this.ctx.currentTime + 4, 1.2);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 8);
  }
}
