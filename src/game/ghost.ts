import type { CarId, GhostFrame, RacerState, TrackGhostRecord, TrackId } from './types';

const GHOST_STORAGE_KEY = 'my_asphalt_ghosts_v1';
const SAMPLE_INTERVAL_SEC = 0.1; // 10Hz compact lap recording

type GhostStoreMap = Partial<Record<TrackId, TrackGhostRecord>>;

export function loadAllTrackGhosts(): GhostStoreMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(GHOST_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as GhostStoreMap;
  } catch {
    return {};
  }
}

export function loadTrackGhost(trackId: TrackId): TrackGhostRecord | null {
  const all = loadAllTrackGhosts();
  return all[trackId] ?? null;
}

export function saveTrackGhost(record: TrackGhostRecord): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const all = loadAllTrackGhosts();
    const existing = all[record.trackId];
    if (existing && existing.lapTime <= record.lapTime) {
      return false;
    }
    all[record.trackId] = record;
    window.localStorage.setItem(GHOST_STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * Pure interpolation for smoothly replaying a Personal Best Ghost lap.
 */
export function sampleGhostFrameAtTime(
  record: TrackGhostRecord,
  lapTimeSec: number,
  trackTotalLength: number
): GhostFrame | null {
  const frames = record.frames;
  if (!frames || frames.length === 0) return null;
  if (frames.length === 1) return frames[0];

  const wrappedT = record.lapTime > 0 ? lapTimeSec % record.lapTime : lapTimeSec;
  if (wrappedT <= frames[0].t) return frames[0];
  const last = frames[frames.length - 1];
  if (wrappedT >= last.t) return last;

  // Binary search for bracketing frames
  let lo = 0;
  let hi = frames.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= wrappedT) lo = mid;
    else hi = mid;
  }

  const a = frames[lo];
  const b = frames[hi];
  const span = Math.max(0.0001, b.t - a.t);
  const alpha = Math.max(0, Math.min(1, (wrappedT - a.t) / span));

  // Shortest-path wrap for track distance s
  let ds = b.s - a.s;
  if (ds > trackTotalLength * 0.5) ds -= trackTotalLength;
  if (ds < -trackTotalLength * 0.5) ds += trackTotalLength;
  const s = ((a.s + ds * alpha) % trackTotalLength + trackTotalLength) % trackTotalLength;

  return {
    t: wrappedT,
    s,
    d: a.d + (b.d - a.d) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    yaw: lerpAngle(a.yaw, b.yaw, alpha),
    pitch: a.pitch + (b.pitch - a.pitch) * alpha,
    roll: a.roll + (b.roll - a.roll) * alpha,
  };
}

export class GhostLapRecorder {
  private frames: GhostFrame[] = [];
  private lastSampleTime = -1;

  public reset(): void {
    this.frames = [];
    this.lastSampleTime = -1;
  }

  public recordStep(racer: RacerState): void {
    const t = racer.currentLapTime;
    if (t < 0) return;
    if (this.lastSampleTime >= 0 && t - this.lastSampleTime < SAMPLE_INTERVAL_SEC) {
      return;
    }
    this.lastSampleTime = t;
    this.frames.push({
      t: Math.round(t * 1000) / 1000,
      s: Math.round(racer.s * 100) / 100,
      d: Math.round(racer.d * 100) / 100,
      y: Math.round(racer.yOffset * 100) / 100,
      yaw: Math.round(racer.worldYaw * 1000) / 1000,
      pitch: Math.round(racer.bodyPitch * 1000) / 1000,
      roll: Math.round(racer.bodyRoll * 1000) / 1000,
    });
  }

  public finishLap(
    trackId: TrackId,
    carId: CarId,
    bodyColor: string,
    lapTime: number
  ): TrackGhostRecord | null {
    if (this.frames.length < 10 || lapTime <= 4) {
      this.reset();
      return null;
    }
    const record: TrackGhostRecord = {
      trackId,
      carId,
      bodyColor,
      lapTime,
      recordedAt: Date.now(),
      frames: this.frames,
    };
    this.reset();
    return record;
  }
}
