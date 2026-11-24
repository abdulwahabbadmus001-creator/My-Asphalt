import type { RacerState } from './types';

export interface ReplayRacerSnapshot {
  id: string;
  s: number;
  d: number;
  yOffset: number;
  worldYaw: number;
  bodyPitch: number;
  bodyRoll: number;
  airRollAngle: number;
  airSpinAngle: number;
  isNitroActive: boolean;
  isShockwave: boolean;
  integrity: number;
  isBrokenDown: boolean;
  eliminated: boolean;
}

export interface ReplayFrame {
  t: number;
  racers: ReplayRacerSnapshot[];
}

const MAX_REPLAY_FRAMES = 300; // 30 seconds at 10 Hz
const REPLAY_INTERVAL_SEC = 0.1;

/**
 * Circular ring buffer recording the last 30 seconds of race action at 10 Hz.
 */
export class ActionReplayRecorder {
  private buffer: ReplayFrame[] = [];
  private lastSampleT = -1;

  public reset(): void {
    this.buffer = [];
    this.lastSampleT = -1;
  }

  public record(raceTime: number, racers: RacerState[]): void {
    if (this.lastSampleT >= 0 && raceTime - this.lastSampleT < REPLAY_INTERVAL_SEC - 1e-6) {
      return;
    }
    this.lastSampleT = raceTime;
    const frame: ReplayFrame = {
      t: Math.round(raceTime * 100) / 100,
      racers: racers.map((r) => ({
        id: r.id,
        s: r.s,
        d: r.d,
        yOffset: r.yOffset,
        worldYaw: r.worldYaw,
        bodyPitch: r.bodyPitch,
        bodyRoll: r.bodyRoll,
        airRollAngle: r.airRollAngle,
        airSpinAngle: r.airSpinAngle,
        isNitroActive: r.isNitroActive,
        isShockwave: r.isShockwave,
        integrity: r.integrity,
        isBrokenDown: r.isBrokenDown,
        eliminated: r.eliminated,
      })),
    };
    this.buffer.push(frame);
    if (this.buffer.length > MAX_REPLAY_FRAMES) {
      this.buffer.shift();
    }
  }

  public getFrames(): ReplayFrame[] {
    return this.buffer;
  }

  public getDuration(): number {
    if (this.buffer.length < 2) return 0;
    return Math.max(0, this.buffer[this.buffer.length - 1].t - this.buffer[0].t);
  }

  public sampleAtOffset(offsetSec: number): ReplayFrame | null {
    if (this.buffer.length === 0) return null;
    if (this.buffer.length === 1) return this.buffer[0];
    const startT = this.buffer[0].t;
    const targetT = startT + Math.max(0, offsetSec);
    let best = this.buffer[0];
    for (let i = 1; i < this.buffer.length; i++) {
      if (this.buffer[i].t <= targetT) {
        best = this.buffer[i];
      } else {
        break;
      }
    }
    return best;
  }
}
