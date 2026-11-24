import type { CarClass, DailyMutatorId, TrackId, WeatherTimeOfDay } from './types';

export interface DailyChallengeSpec {
  dateKey: string; // YYYY-MM-DD
  title: string;
  trackId: TrackId;
  weatherTime: WeatherTimeOfDay;
  carClass: CarClass;
  mutator: DailyMutatorId;
  mutatorLabel: string;
  mutatorDescription: string;
  goldTargetSec: number;
  rewardCash: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashDateString(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getTodayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MUTATOR_CATALOG: Record<
  DailyMutatorId,
  { label: string; description: string; titlePrefix: string }
> = {
  low_gravity: {
    label: 'Moon Gravity',
    description: '0.45x gravity & 1.6x ramp launch height for massive aerial barrel rolls.',
    titlePrefix: 'Lunar Drift',
  },
  infinite_shunt: {
    label: 'Demolition Derby',
    description: '0.2s side-shunt cooldown & 1.5x lateral knockback force.',
    titlePrefix: 'Iron Smash',
  },
  glass_cannon: {
    label: 'Glass Cannon',
    description: '25% max chassis armor for all racers with 3x cash rewards.',
    titlePrefix: 'Sudden Death',
  },
  hyper_charge: {
    label: 'Overdrive Core',
    description: '2x passive Energy/Nitro regen & supercharged Shockwaves.',
    titlePrefix: 'Hyper Surge',
  },
};

export function generateDailyChallenge(dateKey: string = getTodayDateKey()): DailyChallengeSpec {
  const rng = mulberry32(hashDateString(dateKey));
  const tracks: TrackId[] = ['coastal', 'desert', 'night', 'alpine'];
  const weathers: WeatherTimeOfDay[] = ['noon', 'sunset', 'storm'];
  const classes: CarClass[] = ['D', 'C', 'B', 'S', 'HYPER'];
  const mutators: DailyMutatorId[] = [
    'low_gravity',
    'infinite_shunt',
    'glass_cannon',
    'hyper_charge',
  ];

  const trackId = tracks[Math.floor(rng() * tracks.length)];
  const weatherTime = weathers[Math.floor(rng() * weathers.length)];
  const carClass = classes[Math.floor(rng() * classes.length)];
  const mutator = mutators[Math.floor(rng() * mutators.length)];
  const mutInfo = MUTATOR_CATALOG[mutator];

  return {
    dateKey,
    title: `${mutInfo.titlePrefix} • ${dateKey}`,
    trackId,
    weatherTime,
    carClass,
    mutator,
    mutatorLabel: mutInfo.label,
    mutatorDescription: mutInfo.description,
    goldTargetSec: 95 + Math.floor(rng() * 25),
    rewardCash: mutator === 'glass_cannon' ? 4500 : 2500,
  };
}
