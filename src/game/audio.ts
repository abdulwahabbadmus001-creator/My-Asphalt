import type { EngineType } from './types';

interface EngineAcousticProfile {
  osc1Type: OscillatorType;
  osc2Type: OscillatorType;
  osc3Type: OscillatorType;
  idleHz: number;
  rpmSpanHz: number;
  osc2Mult: number;
  osc3Mult: number;
  osc3Gain: number;
  filterBaseHz: number;
  filterSpanHz: number;
  filterQ: number;
  turboWhineGain: number;
  turboWhineBaseHz: number;
  blowOffStartHz: number;
  blowOffEndHz: number;
}

export const ENGINE_PROFILES: Record<EngineType, EngineAcousticProfile> = {
  'turbo-4': {
    osc1Type: 'sawtooth',
    osc2Type: 'triangle',
    osc3Type: 'square',
    idleHz: 58,
    rpmSpanHz: 148,
    osc2Mult: 2.0,
    osc3Mult: 3.01,
    osc3Gain: 0.18,
    filterBaseHz: 290,
    filterSpanHz: 1200,
    filterQ: 2.8,
    turboWhineGain: 0.032,
    turboWhineBaseHz: 950,
    blowOffStartHz: 3600,
    blowOffEndHz: 1050,
  },
  'muscle-v8': {
    osc1Type: 'sawtooth',
    osc2Type: 'square',
    osc3Type: 'triangle',
    idleHz: 42,
    rpmSpanHz: 112,
    osc2Mult: 1.5,
    osc3Mult: 0.5, // deep sub-octave V8 burble
    osc3Gain: 0.42,
    filterBaseHz: 210,
    filterSpanHz: 880,
    filterQ: 3.4,
    turboWhineGain: 0.022,
    turboWhineBaseHz: 780,
    blowOffStartHz: 2400,
    blowOffEndHz: 700,
  },
  'wagon-v8': {
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    osc3Type: 'triangle',
    idleHz: 48,
    rpmSpanHz: 132,
    osc2Mult: 1.5,
    osc3Mult: 2.0,
    osc3Gain: 0.28,
    filterBaseHz: 240,
    filterSpanHz: 1050,
    filterQ: 3.0,
    turboWhineGain: 0.035,
    turboWhineBaseHz: 1100,
    blowOffStartHz: 3300,
    blowOffEndHz: 880,
  },
  'v10-howl': {
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    osc3Type: 'triangle',
    idleHz: 68,
    rpmSpanHz: 196,
    osc2Mult: 1.25, // V10 odd-firing major-third howl
    osc3Mult: 2.5,
    osc3Gain: 0.34,
    filterBaseHz: 340,
    filterSpanHz: 1650,
    filterQ: 3.2,
    turboWhineGain: 0.015,
    turboWhineBaseHz: 1450,
    blowOffStartHz: 4100,
    blowOffEndHz: 1350,
  },
  'italian-v12': {
    osc1Type: 'sawtooth',
    osc2Type: 'triangle',
    osc3Type: 'sawtooth',
    idleHz: 76,
    rpmSpanHz: 235, // high-revving 9000+ RPM Italian V12 shriek
    osc2Mult: 1.5,
    osc3Mult: 3.0,
    osc3Gain: 0.36,
    filterBaseHz: 410,
    filterSpanHz: 2050,
    filterQ: 3.6,
    turboWhineGain: 0.012,
    turboWhineBaseHz: 1600,
    blowOffStartHz: 4400,
    blowOffEndHz: 1500,
  },
  'w16-quad-turbo': {
    osc1Type: 'sawtooth',
    osc2Type: 'square',
    osc3Type: 'triangle',
    idleHz: 50,
    rpmSpanHz: 168,
    osc2Mult: 2.0,
    osc3Mult: 0.5, // colossal W16 low-end authority + quad-turbo whistle
    osc3Gain: 0.45,
    filterBaseHz: 260,
    filterSpanHz: 1550,
    filterQ: 2.9,
    turboWhineGain: 0.055,
    turboWhineBaseHz: 1350,
    blowOffStartHz: 4800,
    blowOffEndHz: 1150,
  },
};

export interface DynamicMusicParams {
  bpm: number;
  stepMs: number;
  /** 0..1 intensity of snare/hi-hat percussion layer */
  percussionLayer: number;
  /** 0..1 intensity of high-RPM driving arpeggio & synth lead layer */
  leadLayer: number;
  /** 0..1 intensity of Nitro / Shockwave chord stab & double-time shimmer layer */
  nitroShimmerLayer: number;
  /** Lowpass filter cutoff for driving bassline */
  bassFilterCutoff: number;
}

/**
 * Pure adaptive soundtrack parameter calculation driven by player RPM, speed, and Nitro state.
 */
export function computeDynamicMusicParams(
  rpmRatio: number,
  speedKmh: number,
  isNitro: boolean,
  isShockwave = false
): DynamicMusicParams {
  const rpm = Math.max(0, Math.min(1, rpmRatio));
  const speedNorm = Math.max(0, Math.min(1, speedKmh / 340));
  const energy = Math.max(0, Math.min(1, rpm * 0.55 + speedNorm * 0.45));

  const nitroBpmBonus = isShockwave ? 16 : isNitro ? 10 : 0;
  const bpm = Math.round(124 + energy * 22 + nitroBpmBonus);
  // 16th note duration in milliseconds = (60 / bpm / 4) * 1000
  const stepMs = Math.max(82, Math.round((15000 / bpm)));

  const percussionLayer = Math.max(0.25, Math.min(1, 0.25 + speedNorm * 0.75 + (isNitro ? 0.2 : 0)));
  const leadLayer = Math.max(0, Math.min(1, (energy - 0.22) * 1.35 + (isNitro ? 0.35 : 0)));
  const nitroShimmerLayer = isShockwave ? 1.0 : isNitro ? 0.68 : Math.max(0, (speedNorm - 0.82) * 1.4);
  const bassFilterCutoff = Math.round(320 + energy * 480 + (isShockwave ? 420 : isNitro ? 240 : 0));

  return {
    bpm,
    stepMs,
    percussionLayer,
    leadLayer,
    nitroShimmerLayer,
    bassFilterCutoff,
  };
}

export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineOsc3: OscillatorNode | null = null;
  private engineOsc3Gain: GainNode | null = null;
  private turboWhineOsc: OscillatorNode | null = null;
  private turboWhineGainNode: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private currentEngineType: EngineType = 'turbo-4';

  private driftNoise: AudioBufferSourceNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;
  private driftGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicEnabled = true;
  private musicShouldPlay = false;

  // Live telemetry driving the adaptive soundtrack
  private liveRpmRatio = 0.22;
  private liveSpeedKmh = 0;
  private liveIsNitro = false;
  private liveIsShockwave = false;

  private volume = 0.72;
  private muted = false;
  private isEngineRunning = false;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.22 : 0;
      this.musicGain.connect(this.masterGain);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.musicShouldPlay && this.musicEnabled && this.musicTimer === null) {
      this.startMusicLoop();
    }
  }

  public setEngineProfile(engineType: EngineType): void {
    this.currentEngineType = engineType;
    const prof = ENGINE_PROFILES[engineType] ?? ENGINE_PROFILES['turbo-4'];
    if (this.engineOsc1) this.engineOsc1.type = prof.osc1Type;
    if (this.engineOsc2) this.engineOsc2.type = prof.osc2Type;
    if (this.engineOsc3) this.engineOsc3.type = prof.osc3Type;
    if (this.engineOsc3Gain && this.ctx) {
      this.engineOsc3Gain.gain.setTargetAtTime(prof.osc3Gain, this.ctx.currentTime, 0.04);
    }
    if (this.engineFilter && this.ctx) {
      this.engineFilter.Q.setTargetAtTime(prof.filterQ, this.ctx.currentTime, 0.05);
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public setVolume(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(enabled ? 0.22 : 0, this.ctx.currentTime, 0.05);
    }
    if (enabled && this.musicShouldPlay) {
      this.startMusicLoop();
    } else if (!enabled) {
      this.stopMusicLoop();
    }
  }

  public startMusic(): void {
    this.musicShouldPlay = true;
    this.unlock();
    if (this.musicEnabled) {
      this.startMusicLoop();
    }
  }

  public stopMusic(): void {
    this.musicShouldPlay = false;
    this.stopMusicLoop();
  }

  private startMusicLoop(): void {
    if (typeof window === 'undefined' || this.musicTimer !== null) return;
    const bassPattern = [
      55, 55, 110, 55, 65.41, 65.41, 130.81, 65.41, 73.42, 73.42, 146.83, 73.42, 82.41, 73.42,
      65.41, 55,
    ];
    const arpPattern = [
      220, 0, 261.63, 329.63, 392, 0, 329.63, 261.63, 293.66, 0, 349.23, 440, 392, 329.63, 293.66,
      261.63,
    ];
    const nitroChordRoots = [220, 261.63, 293.66, 329.63];

    const scheduleStep = () => {
      if (!this.musicShouldPlay || !this.musicEnabled) {
        this.musicTimer = null;
        return;
      }

      const params = computeDynamicMusicParams(
        this.liveRpmRatio,
        this.liveSpeedKmh,
        this.liveIsNitro,
        this.liveIsShockwave
      );

      if (this.ctx && this.musicGain && !this.muted && this.ctx.state === 'running') {
        const now = this.ctx.currentTime;
        const step = this.musicStep % 16;
        const bar = Math.floor(this.musicStep / 16) % 4;
        this.musicStep++;
        const stepSec = params.stepMs / 1000;

        // Layer 1 (Always Active): Driving Synthwave Sawtooth Bassline + Kick
        const bassFreq = bassPattern[step];
        const bOsc = this.ctx.createOscillator();
        const bFilter = this.ctx.createBiquadFilter();
        const bGain = this.ctx.createGain();
        bOsc.type = 'sawtooth';
        bOsc.frequency.setValueAtTime(bassFreq, now);
        bFilter.type = 'lowpass';
        bFilter.frequency.setValueAtTime(
          step % 4 === 0 ? params.bassFilterCutoff + 180 : params.bassFilterCutoff,
          now
        );
        bFilter.Q.value = 3.2;
        bGain.gain.setValueAtTime(0.001, now);
        bGain.gain.linearRampToValueAtTime(0.26, now + 0.01);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + Math.max(0.08, stepSec * 0.92));
        bOsc.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(this.musicGain);
        bOsc.start(now);
        bOsc.stop(now + stepSec + 0.02);

        if (step % 4 === 0) {
          const kOsc = this.ctx.createOscillator();
          const kGain = this.ctx.createGain();
          kOsc.type = 'sine';
          kOsc.frequency.setValueAtTime(150 + params.nitroShimmerLayer * 25, now);
          kOsc.frequency.exponentialRampToValueAtTime(42, now + 0.09);
          kGain.gain.setValueAtTime(0.45 + params.percussionLayer * 0.08, now);
          kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          kOsc.connect(kGain);
          kGain.connect(this.musicGain);
          kOsc.start(now);
          kOsc.stop(now + 0.15);
        }

        // Layer 2 (Dynamic Percussion): Snare & Crisp Hi-Hats scale up with speed
        if ((step === 4 || step === 12) && this.noiseBuffer && params.percussionLayer > 0.28) {
          const sSrc = this.ctx.createBufferSource();
          sSrc.buffer = this.noiseBuffer;
          const sFilt = this.ctx.createBiquadFilter();
          sFilt.type = 'highpass';
          sFilt.frequency.value = 1100;
          const sGain = this.ctx.createGain();
          sGain.gain.setValueAtTime(0.08 + params.percussionLayer * 0.14, now);
          sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          sSrc.connect(sFilt);
          sFilt.connect(sGain);
          sGain.connect(this.musicGain);
          sSrc.start(now);
          sSrc.stop(now + 0.11);
        }

        // Offbeat hi-hats, upgrading to relentless 16th-note hats during Nitro/Shockwave
        const fireHat =
          this.noiseBuffer &&
          ((params.nitroShimmerLayer > 0.5 && step % 1 === 0) ||
            (params.percussionLayer > 0.35 && step % 2 === 1));
        if (fireHat && this.noiseBuffer) {
          const hSrc = this.ctx.createBufferSource();
          hSrc.buffer = this.noiseBuffer;
          const hFilt = this.ctx.createBiquadFilter();
          hFilt.type = 'highpass';
          hFilt.frequency.value = step % 2 === 1 ? 6500 : 8200;
          const hGain = this.ctx.createGain();
          hGain.gain.setValueAtTime(0.03 + params.percussionLayer * 0.045, now);
          hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
          hSrc.connect(hFilt);
          hFilt.connect(hGain);
          hGain.connect(this.musicGain);
          hSrc.start(now);
          hSrc.stop(now + 0.045);
        }

        // Layer 3 (High-RPM Lead): Neon Arpeggio fades in and climbs an octave at high RPM
        const arpFreq = arpPattern[step];
        if (arpFreq > 0 && params.leadLayer > 0.12) {
          const aOsc = this.ctx.createOscillator();
          const aGain = this.ctx.createGain();
          aOsc.type = params.leadLayer > 0.65 ? 'sawtooth' : 'triangle';
          const octaveBoost = params.nitroShimmerLayer > 0.5 ? 2 : this.musicStep % 64 >= 32 ? 1.5 : 1;
          aOsc.frequency.setValueAtTime(arpFreq * octaveBoost, now);
          aGain.gain.setValueAtTime(0.001, now);
          aGain.gain.linearRampToValueAtTime(0.05 + params.leadLayer * 0.09, now + 0.01);
          aGain.gain.exponentialRampToValueAtTime(0.001, now + Math.max(0.11, stepSec * 1.25));
          aOsc.connect(aGain);
          aGain.connect(this.musicGain);
          aOsc.start(now);
          aOsc.stop(now + Math.max(0.13, stepSec * 1.35));
        }

        // Layer 4 (Nitro / Shockwave Surge): Euphoric Supersaw Power Chord Stabs on beats 0 & 6
        if (params.nitroShimmerLayer > 0.3 && (step === 0 || step === 6 || step === 10)) {
          const root = nitroChordRoots[bar];
          const chordNotes = [root * 2, root * 2.5, root * 3];
          for (const freq of chordNotes) {
            const cOsc = this.ctx.createOscillator();
            const cFilt = this.ctx.createBiquadFilter();
            const cGain = this.ctx.createGain();
            cOsc.type = 'sawtooth';
            cOsc.frequency.setValueAtTime(freq, now);
            cFilt.type = 'lowpass';
            cFilt.frequency.setValueAtTime(2400 + params.nitroShimmerLayer * 1400, now);
            cGain.gain.setValueAtTime(0.001, now);
            cGain.gain.linearRampToValueAtTime(0.032 * params.nitroShimmerLayer, now + 0.014);
            cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            cOsc.connect(cFilt);
            cFilt.connect(cGain);
            cGain.connect(this.musicGain);
            cOsc.start(now);
            cOsc.stop(now + 0.22);
          }
        }
      }

      this.musicTimer = window.setTimeout(scheduleStep, params.stepMs);
    };

    this.musicTimer = window.setTimeout(scheduleStep, 115);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public startEngineLoop(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || this.isEngineRunning) return;

    const now = this.ctx.currentTime;
    const prof = ENGINE_PROFILES[this.currentEngineType] ?? ENGINE_PROFILES['turbo-4'];

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(prof.filterBaseHz, now);
    this.engineFilter.Q.setValueAtTime(prof.filterQ, now);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.001, now);

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = prof.osc1Type;
    this.engineOsc1.frequency.setValueAtTime(prof.idleHz, now);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = prof.osc2Type;
    this.engineOsc2.frequency.setValueAtTime(prof.idleHz * prof.osc2Mult, now);

    this.engineOsc3 = this.ctx.createOscillator();
    this.engineOsc3.type = prof.osc3Type;
    this.engineOsc3.frequency.setValueAtTime(prof.idleHz * prof.osc3Mult, now);

    this.engineOsc3Gain = this.ctx.createGain();
    this.engineOsc3Gain.gain.setValueAtTime(prof.osc3Gain, now);

    // Subtle forced-induction turbo/W16 whine oscillator
    this.turboWhineOsc = this.ctx.createOscillator();
    this.turboWhineOsc.type = 'sine';
    this.turboWhineOsc.frequency.setValueAtTime(prof.turboWhineBaseHz, now);
    this.turboWhineGainNode = this.ctx.createGain();
    this.turboWhineGainNode.gain.setValueAtTime(0.0001, now);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineOsc3.connect(this.engineOsc3Gain);
    this.engineOsc3Gain.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.turboWhineOsc.connect(this.turboWhineGainNode);
    this.turboWhineGainNode.connect(this.masterGain);

    this.engineOsc1.start(now);
    this.engineOsc2.start(now);
    this.engineOsc3.start(now);
    this.turboWhineOsc.start(now);

    // Drift tire screech loop
    if (this.noiseBuffer) {
      this.driftNoise = this.ctx.createBufferSource();
      this.driftNoise.buffer = this.noiseBuffer;
      this.driftNoise.loop = true;

      this.driftFilter = this.ctx.createBiquadFilter();
      this.driftFilter.type = 'bandpass';
      this.driftFilter.frequency.setValueAtTime(1650, now);
      this.driftFilter.Q.setValueAtTime(5.0, now);

      this.driftGain = this.ctx.createGain();
      this.driftGain.gain.setValueAtTime(0.0001, now);

      this.driftNoise.connect(this.driftFilter);
      this.driftFilter.connect(this.driftGain);
      this.driftGain.connect(this.masterGain);
      this.driftNoise.start(now);
    }

    this.isEngineRunning = true;
  }

  public updateEngine(
    rpmRatio: number,
    speedKmh: number,
    isDrifting: boolean,
    isNitro: boolean,
    isShockwave = false
  ): void {
    // Always feed live telemetry into the adaptive soundtrack even before AudioContext starts
    this.liveRpmRatio = rpmRatio;
    this.liveSpeedKmh = speedKmh;
    this.liveIsNitro = isNitro;
    this.liveIsShockwave = isShockwave;

    if (
      !this.ctx ||
      !this.isEngineRunning ||
      !this.engineOsc1 ||
      !this.engineOsc2 ||
      !this.engineGain ||
      !this.engineFilter
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    const prof = ENGINE_PROFILES[this.currentEngineType] ?? ENGINE_PROFILES['turbo-4'];

    const nitroPitchBonus = isShockwave ? 68 : isNitro ? 42 : 0;
    const baseFreq = prof.idleHz + rpmRatio * prof.rpmSpanHz + nitroPitchBonus;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.045);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * prof.osc2Mult, now, 0.045);
    if (this.engineOsc3) {
      this.engineOsc3.frequency.setTargetAtTime(baseFreq * prof.osc3Mult, now, 0.045);
    }

    const filterCutoff =
      prof.filterBaseHz +
      rpmRatio * prof.filterSpanHz +
      (isShockwave ? 1200 : isNitro ? 750 : 0);
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.05);

    const targetGain =
      0.062 +
      Math.min(1, speedKmh / 260) * 0.082 +
      (isShockwave ? 0.06 : isNitro ? 0.038 : 0);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);

    if (this.turboWhineOsc && this.turboWhineGainNode) {
      const whineFreq =
        prof.turboWhineBaseHz + rpmRatio * 1450 + (isShockwave ? 950 : isNitro ? 520 : 0);
      const whineLevel =
        rpmRatio > 0.35 ? prof.turboWhineGain * (rpmRatio + (isNitro ? 0.65 : 0)) : 0.0001;
      this.turboWhineOsc.frequency.setTargetAtTime(whineFreq, now, 0.06);
      this.turboWhineGainNode.gain.setTargetAtTime(whineLevel, now, 0.06);
    }

    if (this.driftGain && this.driftFilter) {
      const screechLevel =
        isDrifting && speedKmh > 45 ? Math.min(0.14, (speedKmh / 200) * 0.14) : 0.0001;
      this.driftGain.gain.setTargetAtTime(screechLevel, now, 0.05);
      this.driftFilter.frequency.setTargetAtTime(1400 + rpmRatio * 750, now, 0.06);
    }
  }

  public stopEngineLoop(): void {
    // Reset music intensity to relaxed showroom cruising tempo
    this.liveRpmRatio = 0.22;
    this.liveSpeedKmh = 0;
    this.liveIsNitro = false;
    this.liveIsShockwave = false;

    if (!this.isEngineRunning) return;
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.engineOsc3?.stop();
      this.turboWhineOsc?.stop();
      this.driftNoise?.stop();
    } catch {
      // ignore
    }
    this.engineOsc1?.disconnect();
    this.engineOsc2?.disconnect();
    this.engineOsc3?.disconnect();
    this.engineOsc3Gain?.disconnect();
    this.turboWhineOsc?.disconnect();
    this.turboWhineGainNode?.disconnect();
    this.engineFilter?.disconnect();
    this.engineGain?.disconnect();
    this.driftNoise?.disconnect();
    this.driftFilter?.disconnect();
    this.driftGain?.disconnect();

    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineOsc3 = null;
    this.engineOsc3Gain = null;
    this.turboWhineOsc = null;
    this.turboWhineGainNode = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.driftNoise = null;
    this.driftFilter = null;
    this.driftGain = null;
    this.isEngineRunning = false;
  }

  public playTurboBlowOff(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const prof = ENGINE_PROFILES[this.currentEngineType] ?? ENGINE_PROFILES['turbo-4'];
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(prof.blowOffStartHz, now);
    filter.frequency.exponentialRampToValueAtTime(prof.blowOffEndHz, now + 0.28);
    filter.Q.setValueAtTime(3.2, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.32);
  }

  public playShockwaveBlast(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Deep sub-bass boom + rising neon harmonic sweep
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(36, now + 0.45);
    subGain.gain.setValueAtTime(0.45, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.5);

    const sweep = this.ctx.createOscillator();
    const sweepGain = this.ctx.createGain();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(220, now);
    sweep.frequency.exponentialRampToValueAtTime(980, now + 0.36);
    sweepGain.gain.setValueAtTime(0.16, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    sweep.connect(sweepGain);
    sweepGain.connect(this.masterGain);
    sweep.start(now);
    sweep.stop(now + 0.4);
  }

  public playCollision(intensity = 0.7): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.2, Math.min(1, intensity));

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(130 * clamped + 40, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32 * clamped, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.23);

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.2 * clamped, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.16);
    }
  }

  public playTakedownCrunch(): void {
    this.playCollision(1.0);
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [330, 493.88, 659.25].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  public playBarrierSmash(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(1250, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.17);
  }

  public playCoinChime(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [987.77, 1318.5].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  public playNitroPickup(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.18);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playShieldPickup(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [440, 659.25, 880].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playRampLaunch(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.28);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playBoostPad(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.22);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playCountdownBeep(isGo: boolean): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = isGo ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isGo ? 0.24 : 0.16, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.42 : 0.18));

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.45 : 0.2));
  }

  public playLapChime(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  public playVictoryFanfare(isPodium: boolean): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = isPodium
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
      : [392.0, 440.0, 523.25];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const t = now + idx * 0.11;
      osc.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public playUiClick(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.055);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }
}

export const audioEngine = new ProceduralAudioEngine();
