import {
  CAR_CATALOG,
  CAR_ORDER,
  CAR_TOOLS,
  createDefaultToolsRecord,
  createDefaultUpgrades,
  DRIVER_CATALOG,
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
} from './catalog';
import type {
  CarCustomization,
  CarId,
  CarToolId,
  DriverId,
  PlayerProfile,
  UpgradeStatKey,
} from './types';

const STORAGE_KEY = 'my_asphalt_profile_v2';
const LEGACY_STORAGE_KEYS = [
  'my_asphalt_profile_v1',
  'apex_velocity_profile_v2',
  'apex_velocity_profile_v1',
];

export function createDefaultProfile(): PlayerProfile {
  const isCoarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  const customizations = {} as Record<CarId, CarCustomization>;
  for (const cid of CAR_ORDER) {
    customizations[cid] = { ...CAR_CATALOG[cid].defaultCustomization };
  }

  return {
    playerName: 'Rookie Racer',
    cash: 2400,
    selectedCarId: 'civic_gt',
    unlockedCars: ['civic_gt'],
    selectedDriverId: 'rookie',
    unlockedDrivers: ['rookie'],
    upgrades: createDefaultUpgrades(),
    ownedTools: createDefaultToolsRecord(),
    equippedTools: createDefaultToolsRecord(),
    customizations,
    unlockedTournaments: ['rookie_street'],
    trophies: [],
    activeTournament: null,
    graphicsQuality: 'high',
    volume: 0.72,
    muted: false,
    musicEnabled: true,
    touchControlsEnabled: isCoarsePointer,
  };
}

const LEGACY_CAR_ID_MAP: Record<string, CarId> = {
  gt_track: 'stuttgart_gt3rs',
  cyber_hyper: 'scuderia_sf90',
  apex_zenith: 'veloce_larossa',
};

export function normalizeCarId(rawId: unknown): CarId {
  if (typeof rawId !== 'string') return 'civic_gt';
  if (rawId in CAR_CATALOG) return rawId as CarId;
  if (rawId in LEGACY_CAR_ID_MAP) return LEGACY_CAR_ID_MAP[rawId];
  return 'civic_gt';
}

export function migrateProfileData(
  parsed: Record<string, unknown>,
  defaults: PlayerProfile = createDefaultProfile()
): PlayerProfile {
  const rawCustoms = (parsed.customizations ?? {}) as Record<string, Partial<CarCustomization>>;
  const mergedCustomizations = { ...defaults.customizations };
  for (const [rawKey, val] of Object.entries(rawCustoms)) {
    const cid = normalizeCarId(rawKey);
    if (val && typeof val === 'object') {
      mergedCustomizations[cid] = {
        ...defaults.customizations[cid],
        ...val,
      };
    }
  }

  const rawUpgrades = (parsed.upgrades ?? {}) as Record<string, Partial<PlayerProfile['upgrades'][CarId]>>;
  const mergedUpgrades = { ...defaults.upgrades };
  for (const [rawKey, val] of Object.entries(rawUpgrades)) {
    const cid = normalizeCarId(rawKey);
    if (val && typeof val === 'object') {
      mergedUpgrades[cid] = {
        ...defaults.upgrades[cid],
        ...val,
      };
    }
  }

  const rawOwnedTools = (parsed.ownedTools ?? {}) as Record<string, CarToolId[]>;
  const rawEquippedTools = (parsed.equippedTools ?? {}) as Record<string, CarToolId[]>;
  const mergedOwnedTools = { ...defaults.ownedTools };
  const mergedEquippedTools = { ...defaults.equippedTools };
  for (const [rawKey, val] of Object.entries(rawOwnedTools)) {
    const cid = normalizeCarId(rawKey);
    if (Array.isArray(val)) {
      mergedOwnedTools[cid] = Array.from(new Set([...(mergedOwnedTools[cid] ?? []), ...val]));
    }
  }
  for (const [rawKey, val] of Object.entries(rawEquippedTools)) {
    const cid = normalizeCarId(rawKey);
    if (Array.isArray(val)) {
      mergedEquippedTools[cid] = Array.from(new Set([...(mergedEquippedTools[cid] ?? []), ...val]));
    }
  }

  const rawUnlockedCars = Array.isArray(parsed.unlockedCars) ? parsed.unlockedCars : [];
  const normalizedUnlockedCars = Array.from(
    new Set(rawUnlockedCars.map((id) => normalizeCarId(id)))
  );
  const unlockedCars =
    normalizedUnlockedCars.length > 0 ? normalizedUnlockedCars : defaults.unlockedCars;

  const selectedCarId = normalizeCarId(parsed.selectedCarId);
  const safeSelectedCarId = unlockedCars.includes(selectedCarId) ? selectedCarId : unlockedCars[0];

  const rawActiveT = parsed.activeTournament as PlayerProfile['activeTournament'] | undefined;
  const activeTournament =
    rawActiveT && Array.isArray(rawActiveT.standings)
      ? {
          ...rawActiveT,
          standings: rawActiveT.standings.map((row) => ({
            ...row,
            carId: normalizeCarId(row.carId),
          })),
        }
      : null;

  return {
    ...defaults,
    ...(parsed as Partial<PlayerProfile>),
    selectedCarId: safeSelectedCarId,
    unlockedCars,
    unlockedDrivers:
      Array.isArray(parsed.unlockedDrivers) && parsed.unlockedDrivers.length > 0
        ? (parsed.unlockedDrivers as DriverId[])
        : defaults.unlockedDrivers,
    unlockedTournaments:
      Array.isArray(parsed.unlockedTournaments) && parsed.unlockedTournaments.length > 0
        ? (parsed.unlockedTournaments as PlayerProfile['unlockedTournaments'])
        : defaults.unlockedTournaments,
    trophies: Array.isArray(parsed.trophies)
      ? (parsed.trophies as PlayerProfile['trophies'])
      : defaults.trophies,
    activeTournament,
    upgrades: mergedUpgrades,
    ownedTools: mergedOwnedTools,
    equippedTools: mergedEquippedTools,
    customizations: mergedCustomizations,
  };
}

export function loadProfile(): PlayerProfile {
  const defaults = createDefaultProfile();
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaults;
  }
  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacyRaw = window.localStorage.getItem(legacyKey);
        if (legacyRaw) {
          raw = legacyRaw;
          break;
        }
      }
    }
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return migrateProfileData(parsed, defaults);
  } catch {
    return defaults;
  }
}

export function saveProfile(profile: PlayerProfile): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function unlockOrEquipCarInProfile(profile: PlayerProfile, carId: CarId): PlayerProfile {
  if (profile.unlockedCars.includes(carId)) {
    return { ...profile, selectedCarId: carId };
  }
  const price = CAR_CATALOG[carId].price;
  if (profile.cash < price) return profile;

  return {
    ...profile,
    cash: profile.cash - price,
    unlockedCars: [...profile.unlockedCars, carId],
    selectedCarId: carId,
  };
}

export function recruitOrSelectDriverInProfile(
  profile: PlayerProfile,
  driverId: DriverId
): PlayerProfile {
  if (profile.unlockedDrivers.includes(driverId)) {
    return {
      ...profile,
      selectedDriverId: driverId,
      playerName: DRIVER_CATALOG[driverId].name,
    };
  }
  const price = DRIVER_CATALOG[driverId].price;
  if (profile.cash < price) return profile;

  return {
    ...profile,
    cash: profile.cash - price,
    unlockedDrivers: [...profile.unlockedDrivers, driverId],
    selectedDriverId: driverId,
    playerName: DRIVER_CATALOG[driverId].name,
  };
}

export function upgradeCarStatInProfile(
  profile: PlayerProfile,
  carId: CarId,
  stat: UpgradeStatKey
): PlayerProfile {
  if (!profile.unlockedCars.includes(carId)) return profile;
  const currentLevel = profile.upgrades[carId][stat];
  if (currentLevel >= MAX_UPGRADE_LEVEL) return profile;

  const cost = getUpgradeCost(carId, currentLevel);
  if (profile.cash < cost) return profile;

  return {
    ...profile,
    cash: profile.cash - cost,
    upgrades: {
      ...profile.upgrades,
      [carId]: {
        ...profile.upgrades[carId],
        [stat]: currentLevel + 1,
      },
    },
  };
}

export function buyOrToggleCarToolInProfile(
  profile: PlayerProfile,
  carId: CarId,
  toolId: CarToolId
): PlayerProfile {
  if (!profile.unlockedCars.includes(carId)) return profile;
  const owned = profile.ownedTools[carId] ?? [];
  const equipped = profile.equippedTools[carId] ?? [];

  if (owned.includes(toolId)) {
    // Toggle equipped on/off
    const nextEquipped = equipped.includes(toolId)
      ? equipped.filter((t) => t !== toolId)
      : [...equipped, toolId];
    return {
      ...profile,
      equippedTools: {
        ...profile.equippedTools,
        [carId]: nextEquipped,
      },
    };
  }

  // Purchase and auto-equip
  const price = CAR_TOOLS[toolId].price;
  if (profile.cash < price) return profile;

  return {
    ...profile,
    cash: profile.cash - price,
    ownedTools: {
      ...profile.ownedTools,
      [carId]: [...owned, toolId],
    },
    equippedTools: {
      ...profile.equippedTools,
      [carId]: [...equipped, toolId],
    },
  };
}

export function updateCarCustomizationInProfile(
  profile: PlayerProfile,
  carId: CarId,
  patch: Partial<CarCustomization>
): PlayerProfile {
  return {
    ...profile,
    customizations: {
      ...profile.customizations,
      [carId]: {
        ...profile.customizations[carId],
        ...patch,
      },
    },
  };
}
