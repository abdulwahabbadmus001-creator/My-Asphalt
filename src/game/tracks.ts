import { TRACK_CATALOG } from './catalog';
import type {
  BoostPad,
  PickupKind,
  SmashableBarrier,
  TrackId,
  TrackPickup,
  TrackRamp,
  TrackSample,
  Vec3Like,
} from './types';

export interface MinimapData {
  points: { x: number; y: number }[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  scale: number;
  offsetX: number;
  offsetZ: number;
}

export interface TrackData {
  id: TrackId;
  roadWidth: number;
  totalLength: number;
  samples: TrackSample[];
  boostPads: BoostPad[];
  ramps: TrackRamp[];
  pickupTemplates: Omit<TrackPickup, 'collected' | 'respawnTimer'>[];
  smashableTemplates: Omit<SmashableBarrier, 'smashed' | 'respawnTimer'>[];
  minimap: MinimapData;
}

// 4 Distinct Closed-Loop Spline Circuits (~1050m-1250m)
const TRACK_CONTROL_POINTS: Record<TrackId, Vec3Like[]> = {
  // 1. Sunny Coastal Highway
  coastal: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: -145 },
    { x: 52, y: 2.5, z: -260 },
    { x: 175, y: 5.5, z: -285 },
    { x: 280, y: 3.5, z: -205 },
    { x: 295, y: 1.5, z: -72 },
    { x: 230, y: 0.5, z: 24 },
    { x: 275, y: 2.0, z: 128 },
    { x: 225, y: 3.0, z: 228 },
    { x: 112, y: 1.5, z: 245 },
    { x: 24, y: 0.5, z: 170 },
    { x: 0, y: 0, z: 88 },
  ],
  // 2. Sunset Desert Canyon
  desert: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0.5, z: -155 },
    { x: -70, y: 4.5, z: -268 },
    { x: -205, y: 8.5, z: -255 },
    { x: -270, y: 6.5, z: -135 },
    { x: -172, y: 3.0, z: -45 },
    { x: -255, y: 5.0, z: 80 },
    { x: -222, y: 6.5, z: 208 },
    { x: -108, y: 3.5, z: 250 },
    { x: -14, y: 1.0, z: 165 },
    { x: 0, y: 0, z: 86 },
  ],
  // 3. Rainy Neon Night City
  night: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: -175 },
    { x: 74, y: 3.2, z: -288 },
    { x: 205, y: 6.0, z: -295 },
    { x: 312, y: 3.2, z: -200 },
    { x: 295, y: 1.0, z: -48 },
    { x: 196, y: 2.5, z: 48 },
    { x: 272, y: 4.2, z: 172 },
    { x: 188, y: 2.0, z: 274 },
    { x: 60, y: 0.5, z: 252 },
    { x: 0, y: 0, z: 125 },
  ],
  // 4. Alpine Mountain Pass (dramatic mountain climbs, ridge sweepers, and rapid descent)
  alpine: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1.5, z: -150 },
    { x: -85, y: 8.5, z: -255 },
    { x: -205, y: 14.0, z: -220 },
    { x: -245, y: 12.0, z: -90 },
    { x: -140, y: 7.0, z: -15 },
    { x: -235, y: 10.5, z: 95 },
    { x: -190, y: 13.0, z: 220 },
    { x: -75, y: 6.5, z: 255 },
    { x: 18, y: 2.0, z: 175 },
    { x: 0, y: 0, z: 85 },
  ],
};

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function evalClosedCatmullRom(points: Vec3Like[], u: number): Vec3Like {
  const n = points.length;
  const wrapped = ((u % 1) + 1) % 1;
  const scaled = wrapped * n;
  const seg = Math.floor(scaled) % n;
  const localT = scaled - Math.floor(scaled);

  const p0 = points[(seg - 1 + n) % n];
  const p1 = points[seg];
  const p2 = points[(seg + 1) % n];
  const p3 = points[(seg + 2) % n];

  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, localT),
    y: catmullRom(p0.y, p1.y, p2.y, p3.y, localT),
    z: catmullRom(p0.z, p1.z, p2.z, p3.z, localT),
  };
}

function normalizeVec3(v: Vec3Like): Vec3Like {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

const trackCache = new Map<TrackId, TrackData>();

export function getTrackData(trackId: TrackId): TrackData {
  const cached = trackCache.get(trackId);
  if (cached) return cached;

  const spec = TRACK_CATALOG[trackId];
  const ctrl = TRACK_CONTROL_POINTS[trackId];

  const denseCount = 960;
  const densePts: Vec3Like[] = [];
  const cumLen: number[] = [0];

  for (let i = 0; i <= denseCount; i++) {
    const pt = evalClosedCatmullRom(ctrl, i / denseCount);
    densePts.push(pt);
    if (i > 0) {
      const prev = densePts[i - 1];
      const segLen = Math.hypot(pt.x - prev.x, pt.y - prev.y, pt.z - prev.z);
      cumLen.push(cumLen[i - 1] + segLen);
    }
  }

  const totalLength = cumLen[denseCount];
  const sampleCount = 360;
  const uniformPts: Vec3Like[] = [];

  let denseIdx = 0;
  for (let i = 0; i < sampleCount; i++) {
    const targetS = (i / sampleCount) * totalLength;
    while (denseIdx < denseCount - 1 && cumLen[denseIdx + 1] < targetS) {
      denseIdx++;
    }
    const s0 = cumLen[denseIdx];
    const s1 = cumLen[denseIdx + 1];
    const alpha = s1 > s0 ? (targetS - s0) / (s1 - s0) : 0;
    const a = densePts[denseIdx];
    const b = densePts[denseIdx + 1];
    uniformPts.push({
      x: a.x + (b.x - a.x) * alpha,
      y: a.y + (b.y - a.y) * alpha,
      z: a.z + (b.z - a.z) * alpha,
    });
  }

  const samples: TrackSample[] = [];
  const ds = totalLength / sampleCount;

  for (let i = 0; i < sampleCount; i++) {
    const prev = uniformPts[(i - 1 + sampleCount) % sampleCount];
    const curr = uniformPts[i];
    const next = uniformPts[(i + 1) % sampleCount];

    const tangent = normalizeVec3({
      x: next.x - prev.x,
      y: next.y - prev.y,
      z: next.z - prev.z,
    });

    const right = normalizeVec3({
      x: -tangent.z,
      y: 0,
      z: tangent.x,
    });

    const prevT = normalizeVec3({ x: curr.x - prev.x, y: 0, z: curr.z - prev.z });
    const nextT = normalizeVec3({ x: next.x - curr.x, y: 0, z: next.z - curr.z });
    const crossY = prevT.z * nextT.x - prevT.x * nextT.z;
    const dot = Math.max(-1, Math.min(1, prevT.x * nextT.x + prevT.z * nextT.z));
    const angle = Math.acos(dot) * (crossY >= 0 ? 1 : -1);
    const curvature = angle / ds;

    samples.push({
      s: i * ds,
      t: i / sampleCount,
      pos: curr,
      tangent,
      right,
      curvature,
    });
  }

  // 6 Glowing Speed Boost Pads
  const boostFractions = [0.09, 0.25, 0.42, 0.59, 0.76, 0.91];
  const boostLateralPattern = [0, -4.0, 4.0, 0, -3.8, 3.8];
  const boostPads: BoostPad[] = boostFractions.map((frac, idx) => ({
    id: idx,
    s: frac * totalLength,
    d: boostLateralPattern[idx % boostLateralPattern.length],
    length: 12,
    width: 4.8,
  }));

  // 4 High-Impact 3D Jump Ramps placed on exciting straights & outer lanes
  const rampFractions = [0.16, 0.36, 0.66, 0.84];
  const rampLateralPattern = [3.8, -4.2, 4.0, -3.5];
  const ramps: TrackRamp[] = rampFractions.map((frac, idx) => ({
    id: idx,
    s: frac * totalLength,
    d: rampLateralPattern[idx % rampLateralPattern.length],
    length: 13,
    width: 5.2,
    height: 2.35,
  }));

  // 16 On-Track 3D Pickups (Cash Coins, Blue/Gold Nitro Bottles, Impact Shields)
  const pickupKinds: PickupKind[] = [
    'coin',
    'nitro_blue',
    'coin',
    'nitro_gold',
    'coin',
    'shield',
    'nitro_blue',
    'coin',
    'nitro_gold',
    'coin',
    'nitro_blue',
    'shield',
    'coin',
    'nitro_gold',
    'coin',
    'nitro_blue',
  ];
  const pickupTemplates: Omit<TrackPickup, 'collected' | 'respawnTimer'>[] = pickupKinds.map(
    (kind, idx) => {
      const frac = 0.055 + idx * 0.058;
      // Risk-reward placement: outer lanes & floating right above jump ramp crests
      let d = (idx % 3 === 0 ? -5.8 : idx % 3 === 1 ? 5.8 : 0);
      let yOffset = 1.05;
      // Put select Gold Nitro / Coins suspended right off ramp crests
      for (const r of ramps) {
        if (Math.abs(frac * totalLength - (r.s + 8)) < 26) {
          d = r.d;
          yOffset = r.height + 1.1;
          break;
        }
      }
      return {
        id: idx,
        kind,
        s: wrapTrackDistance(frac * totalLength, totalLength),
        d,
        yOffset,
      };
    }
  );

  // 18 Smashable Trackside Hazard Barriers along outer road shoulders
  const halfRoad = spec.roadWidth * 0.5;
  const smashableTemplates: Omit<SmashableBarrier, 'smashed' | 'respawnTimer'>[] = [];
  for (let i = 0; i < 18; i++) {
    const frac = 0.04 + i * 0.052;
    const s = wrapTrackDistance(frac * totalLength, totalLength);
    const side = i % 2 === 0 ? 1 : -1;
    const d = side * (halfRoad - 2.35);
    const smp = samples[Math.floor((s / totalLength) * sampleCount) % sampleCount];
    smashableTemplates.push({
      id: i,
      s,
      d,
      pos: {
        x: smp.pos.x + smp.right.x * d,
        y: smp.pos.y,
        z: smp.pos.z + smp.right.z * d,
      },
      yaw: Math.atan2(smp.tangent.x, smp.tangent.z),
    });
  }

  // Normalized 2D Minimap bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const smp of samples) {
    if (smp.pos.x < minX) minX = smp.pos.x;
    if (smp.pos.x > maxX) maxX = smp.pos.x;
    if (smp.pos.z < minZ) minZ = smp.pos.z;
    if (smp.pos.z > maxZ) maxZ = smp.pos.z;
  }
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const maxSpan = Math.max(spanX, spanZ);
  const pad = 0.1;
  const scale = (1 - pad * 2) / maxSpan;
  const offsetX = pad + (maxSpan - spanX) * 0.5 * scale;
  const offsetZ = pad + (maxSpan - spanZ) * 0.5 * scale;

  const minimapPoints: { x: number; y: number }[] = [];
  for (let i = 0; i < sampleCount; i += 3) {
    const p = samples[i].pos;
    minimapPoints.push({
      x: (p.x - minX) * scale + offsetX,
      y: (p.z - minZ) * scale + offsetZ,
    });
  }

  const data: TrackData = {
    id: trackId,
    roadWidth: spec.roadWidth,
    totalLength,
    samples,
    boostPads,
    ramps,
    pickupTemplates,
    smashableTemplates,
    minimap: {
      points: minimapPoints,
      minX,
      maxX,
      minZ,
      maxZ,
      scale,
      offsetX,
      offsetZ,
    },
  };

  trackCache.set(trackId, data);
  return data;
}

export function wrapTrackDistance(s: number, totalLength: number): number {
  const m = s % totalLength;
  return m < 0 ? m + totalLength : m;
}

export function sampleTrackAtDistance(track: TrackData, s: number): TrackSample {
  const n = track.samples.length;
  const wrapped = wrapTrackDistance(s, track.totalLength);
  const exactIdx = (wrapped / track.totalLength) * n;
  const i0 = Math.floor(exactIdx) % n;
  const i1 = (i0 + 1) % n;
  const frac = exactIdx - Math.floor(exactIdx);

  const a = track.samples[i0];
  const b = track.samples[i1];

  const tangent = normalizeVec3({
    x: a.tangent.x + (b.tangent.x - a.tangent.x) * frac,
    y: a.tangent.y + (b.tangent.y - a.tangent.y) * frac,
    z: a.tangent.z + (b.tangent.z - a.tangent.z) * frac,
  });

  const right = normalizeVec3({
    x: -tangent.z,
    y: 0,
    z: tangent.x,
  });

  return {
    s: wrapped,
    t: wrapped / track.totalLength,
    pos: {
      x: a.pos.x + (b.pos.x - a.pos.x) * frac,
      y: a.pos.y + (b.pos.y - a.pos.y) * frac,
      z: a.pos.z + (b.pos.z - a.pos.z) * frac,
    },
    tangent,
    right,
    curvature: a.curvature + (b.curvature - a.curvature) * frac,
  };
}

export function worldToMinimap(
  track: TrackData,
  worldPos: Vec3Like
): { x: number; y: number } {
  const m = track.minimap;
  return {
    x: (worldPos.x - m.minX) * m.scale + m.offsetX,
    y: (worldPos.z - m.minZ) * m.scale + m.offsetZ,
  };
}
