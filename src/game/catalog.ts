import type {
  AIRivalProfile,
  CarClass,
  CarId,
  CarSpec,
  CarToolId,
  CarToolSpec,
  CombatModId,
  ComputedCarPerformance,
  DriverId,
  DriverPerkModifiers,
  DriverSpec,
  TournamentId,
  TournamentSpec,
  TournamentStanding,
  TrackId,
  TrackSpec,
  UpgradeLevels,
  UpgradeStatKey,
} from './types';

export const MAX_UPGRADE_LEVEL = 5;

export const CLASS_COLORS: Record<CarClass, { bg: string; text: string; border: string }> = {
  D: { bg: '#1e3a5f', text: '#7dd3fc', border: '#38bdf8' },
  C: { bg: '#144336', text: '#6ee7b7', border: '#10b981' },
  B: { bg: '#45280c', text: '#fcd34d', border: '#f59e0b' },
  S: { bg: '#4c1138', text: '#f0abfc', border: '#d946ef' },
  HYPER: { bg: '#4c0519', text: '#fde047', border: '#f43f5e' },
};

export const PAINT_SWATCHES: { name: string; hex: string }[] = [
  { name: 'Velocity Crimson', hex: '#e11d48' },
  { name: 'Solar Amber', hex: '#f59e0b' },
  { name: 'Cobalt GT', hex: '#2563eb' },
  { name: 'Emerald Apex', hex: '#10b981' },
  { name: 'Glacier White', hex: '#e2e8f0' },
  { name: 'Stealth Carbon', hex: '#1e293b' },
  { name: 'Hyper Magenta', hex: '#c026d3' },
  { name: 'Electric Cyan', hex: '#06b6d4' },
  { name: 'Sunset Orange', hex: '#ea580c' },
  { name: 'Acid Lime', hex: '#84cc16' },
];

export const RIM_SWATCHES: { name: string; hex: string }[] = [
  { name: 'Forged Silver', hex: '#cbd5e1' },
  { name: 'Matte Black', hex: '#18181b' },
  { name: 'Motorsport Gold', hex: '#eab308' },
  { name: 'Bronze Alloy', hex: '#b45309' },
  { name: 'Gunmetal', hex: '#64748b' },
  { name: 'Racing Red', hex: '#ef4444' },
  { name: 'Ice Cyan', hex: '#38bdf8' },
];

export const CALIPER_SWATCHES: { name: string; hex: string }[] = [
  { name: 'Brembo Red', hex: '#ef4444' },
  { name: 'Carbon Yellow', hex: '#facc15' },
  { name: 'Acid Green', hex: '#22c55e' },
  { name: 'Electric Blue', hex: '#38bdf8' },
  { name: 'Shockwave Purple', hex: '#d946ef' },
  { name: 'Titanium Silver', hex: '#cbd5e1' },
];

export const UNDERGLOW_SWATCHES: { name: string; hex: string }[] = [
  { name: 'Off', hex: 'none' },
  { name: 'Cyan Pulse', hex: '#06b6d4' },
  { name: 'Shockwave Magenta', hex: '#d946ef' },
  { name: 'Amber Forge', hex: '#f59e0b' },
  { name: 'Crimson Glow', hex: '#ef4444' },
  { name: 'Venom Green', hex: '#22c55e' },
  { name: 'Pure White', hex: '#f8fafc' },
];

// ==================== 18 DISTINCT CARS ACROSS 5 CLASSES (D / C / B / S / HYPER) ====================

export const CAR_CATALOG: Record<CarId, CarSpec> = {
  civic_gt: {
    id: 'civic_gt',
    name: 'Apex Street Tuner',
    carClass: 'D',
    category: 'JDM Street Coupe',
    brandOrigin: 'Yokohama • Japan',
    engineType: 'turbo-4',
    engineLabel: '2.0L TWIN-TURBO I4',
    silhouette: 'civic_gt',
    tagline: 'Nimble twin-turbo street machine with forgiving drift control and quick launch.',
    price: 0,
    basePowerRating: 1120,
    baseStats: { topSpeed: 54, acceleration: 58, handling: 66, nitro: 56 },
    defaultCustomization: {
      bodyColor: '#2563eb',
      finish: 'metallic',
      rimColor: '#cbd5e1',
      caliperColor: '#ef4444',
      underglowColor: '#06b6d4',
    },
  },
  rally_hatch: {
    id: 'rally_hatch',
    name: 'Stratos Evo RS',
    carClass: 'D',
    category: 'AWD Hot Hatch',
    brandOrigin: 'Turin • Italy',
    engineType: 'turbo-4',
    engineLabel: '2.0L RALLY TURBO',
    silhouette: 'rally_hatch',
    tagline: 'Short-wheelbase turbo hatchback built for tight hairpins and rapid nitro buildup.',
    price: 2200,
    basePowerRating: 1420,
    baseStats: { topSpeed: 60, acceleration: 66, handling: 74, nitro: 62 },
    defaultCustomization: {
      bodyColor: '#f59e0b',
      finish: 'metallic',
      rimColor: '#18181b',
      caliperColor: '#facc15',
      underglowColor: '#f59e0b',
    },
  },
  muscle_v8: {
    id: 'muscle_v8',
    name: 'Dominator V8 GT',
    carClass: 'C',
    category: 'Supercharged Muscle',
    brandOrigin: 'Detroit • USA',
    engineType: 'muscle-v8',
    engineLabel: '6.2L SUPERCHARGED V8',
    silhouette: 'muscle_v8',
    tagline: 'Raw supercharged V8 torque, heavy chassis punch for takedowns, and smoky slides.',
    price: 4500,
    basePowerRating: 1820,
    baseStats: { topSpeed: 72, acceleration: 70, handling: 60, nitro: 68 },
    defaultCustomization: {
      bodyColor: '#e11d48',
      finish: 'matte',
      rimColor: '#18181b',
      caliperColor: '#ef4444',
      underglowColor: '#ef4444',
    },
  },
  coupe_drift: {
    id: 'coupe_drift',
    name: 'Kuro Silvia Spec-R',
    carClass: 'C',
    category: 'Widebody Drift GT',
    brandOrigin: 'Tokyo • Japan',
    engineType: 'turbo-4',
    engineLabel: '2.4L DRIFT TURBO',
    silhouette: 'coupe_drift',
    tagline: 'Wide-track canyon drifter tuned to hold extreme slip angles and chain boost pads.',
    price: 6800,
    basePowerRating: 2080,
    baseStats: { topSpeed: 75, acceleration: 74, handling: 78, nitro: 74 },
    defaultCustomization: {
      bodyColor: '#06b6d4',
      finish: 'metallic',
      rimColor: '#eab308',
      caliperColor: '#38bdf8',
      underglowColor: '#06b6d4',
    },
  },
  ingolstadt_rs6: {
    id: 'ingolstadt_rs6',
    name: 'Ingolstadt RS6 Avant',
    carClass: 'C',
    category: 'Widebody Sport Wagon',
    brandOrigin: 'Ingolstadt • Germany',
    engineType: 'wagon-v8',
    engineLabel: '4.0L BI-TURBO V8',
    secondaryColor: '#0f172a',
    silhouette: 'ingolstadt_rs6',
    tagline: 'Widebody performance wagon with hexagonal honeycomb grille, roof rails, and relentless AWD launch.',
    price: 8600,
    basePowerRating: 2280,
    baseStats: { topSpeed: 78, acceleration: 79, handling: 76, nitro: 74 },
    defaultCustomization: {
      bodyColor: '#64748b',
      finish: 'metallic',
      rimColor: '#18181b',
      caliperColor: '#ef4444',
      underglowColor: 'none',
    },
  },
  rally_raid: {
    id: 'rally_raid',
    name: 'Alpine Turbo Quattro',
    carClass: 'B',
    category: 'Group-B Turbo Widebody',
    brandOrigin: 'Ingolstadt • Germany',
    engineType: 'turbo-4',
    engineLabel: '2.5L GROUP-B 5-CYL',
    silhouette: 'rally_raid',
    tagline: 'Blistering all-wheel traction engineered to dominate alpine passes and rain-slick streets.',
    price: 11200,
    basePowerRating: 2560,
    baseStats: { topSpeed: 80, acceleration: 84, handling: 85, nitro: 78 },
    defaultCustomization: {
      bodyColor: '#10b981',
      finish: 'metallic',
      rimColor: '#cbd5e1',
      caliperColor: '#22c55e',
      underglowColor: '#22c55e',
    },
  },
  yokohama_gtr: {
    id: 'yokohama_gtr',
    name: 'Yokohama GT-R Nismo',
    carClass: 'B',
    category: 'AWD Track Godzilla',
    brandOrigin: 'Yokohama • Japan',
    engineType: 'turbo-4',
    engineLabel: '3.8L TWIN-TURBO V6',
    secondaryColor: '#111827',
    silhouette: 'yokohama_gtr',
    tagline: 'Muscular carbon-hood GT-R with V-motion grille, quad round afterburner taillights, and violent grip.',
    price: 13800,
    basePowerRating: 2740,
    baseStats: { topSpeed: 84, acceleration: 86, handling: 83, nitro: 80 },
    defaultCustomization: {
      bodyColor: '#e2e8f0',
      finish: 'metallic',
      rimColor: '#18181b',
      caliperColor: '#ef4444',
      underglowColor: '#ef4444',
    },
  },
  marinelli_f40: {
    id: 'marinelli_f40',
    name: 'Marinelli F40 Turbo',
    carClass: 'B',
    category: 'Iconic Twin-Turbo Legend',
    brandOrigin: 'Maranello • Italy',
    engineType: 'wagon-v8',
    engineLabel: '2.9L TWIN-TURBO V8',
    silhouette: 'marinelli_f40',
    tagline: 'Wedge-nose Italian icon with NACA side ducts, tall integrated rear box wing, and raw turbo boost.',
    price: 16500,
    basePowerRating: 2920,
    baseStats: { topSpeed: 86, acceleration: 84, handling: 86, nitro: 82 },
    defaultCustomization: {
      bodyColor: '#e11d48',
      finish: 'metallic',
      rimColor: '#cbd5e1',
      caliperColor: '#facc15',
      underglowColor: 'none',
    },
  },
  stuttgart_gt3rs: {
    id: 'stuttgart_gt3rs',
    name: 'Stuttgart 911 GT3 RS',
    carClass: 'B',
    category: 'Motorsport Track Weapon',
    brandOrigin: 'Stuttgart • Germany',
    engineType: 'v10-howl',
    engineLabel: '4.0L FLAT-6 9000RPM',
    secondaryColor: '#18181b',
    silhouette: 'stuttgart_gt3rs',
    tagline: 'Sloping fastback silhouette, front fender louvers, and massive swan-neck GT wing built for surgical apexes.',
    price: 19500,
    basePowerRating: 3100,
    baseStats: { topSpeed: 87, acceleration: 87, handling: 93, nitro: 84 },
    defaultCustomization: {
      bodyColor: '#84cc16',
      finish: 'metallic',
      rimColor: '#18181b',
      caliperColor: '#facc15',
      underglowColor: '#22c55e',
    },
  },
  vorsprung_r8: {
    id: 'vorsprung_r8',
    name: 'Vorsprung R8 V10 Plus',
    carClass: 'S',
    category: 'Mid-Engine V10 Coupe',
    brandOrigin: 'Ingolstadt • Germany',
    engineType: 'v10-howl',
    engineLabel: '5.2L NA V10',
    secondaryColor: '#0f172a',
    silhouette: 'vorsprung_r8',
    tagline: 'Mid-engine precision coupe with contrasting carbon sideblades, angular LED DRLs, and howling V10 bay.',
    price: 24500,
    basePowerRating: 3460,
    baseStats: { topSpeed: 91, acceleration: 90, handling: 91, nitro: 87 },
    defaultCustomization: {
      bodyColor: '#2563eb',
      finish: 'metallic',
      rimColor: '#cbd5e1',
      caliperColor: '#ef4444',
      underglowColor: '#06b6d4',
    },
  },
  scuderia_sf90: {
    id: 'scuderia_sf90',
    name: 'Scuderia SF90 Stradale',
    carClass: 'S',
    category: 'Hybrid Mid-Engine Supercar',
    brandOrigin: 'Maranello • Italy',
    engineType: 'italian-v12',
    engineLabel: '4.0L HYBRID V8 1000HP',
    secondaryColor: '#111827',
    silhouette: 'scuderia_sf90',
    tagline: 'Cab-forward electrified Italian supercar with C-shaped LED headlamps and instant e-motor torque.',
    price: 29500,
    basePowerRating: 3680,
    baseStats: { topSpeed: 93, acceleration: 94, handling: 90, nitro: 90 },
    defaultCustomization: {
      bodyColor: '#e11d48',
      finish: 'metallic',
      rimColor: '#eab308',
      caliperColor: '#facc15',
      underglowColor: '#ef4444',
    },
  },
  santagata_svj: {
    id: 'santagata_svj',
    name: "Sant'Agata Aventador SVJ",
    carClass: 'S',
    category: 'V12 Flagship Raging Bull',
    brandOrigin: "Sant'Agata • Italy",
    engineType: 'italian-v12',
    engineLabel: '6.5L NA V12',
    secondaryColor: '#0f172a',
    silhouette: 'santagata_svj',
    tagline: 'Stealth-fighter hexagonal bodywork, Y-shaped LED lighting, and a screaming naturally aspirated V12.',
    price: 34500,
    basePowerRating: 3880,
    baseStats: { topSpeed: 95, acceleration: 93, handling: 89, nitro: 92 },
    defaultCustomization: {
      bodyColor: '#f59e0b',
      finish: 'matte',
      rimColor: '#18181b',
      caliperColor: '#facc15',
      underglowColor: '#f59e0b',
    },
  },
  woking_p1: {
    id: 'woking_p1',
    name: 'Woking P1 GTR',
    carClass: 'HYPER',
    category: 'Track-Only Hybrid Hypercar',
    brandOrigin: 'Woking • UK',
    engineType: 'v10-howl',
    engineLabel: '3.8L HYBRID TWIN-TURBO',
    secondaryColor: '#111827',
    silhouette: 'woking_p1',
    tagline: 'Teardrop glass canopy, boomerang LED headlights, deep door channels, and relentless track downforce.',
    price: 41000,
    basePowerRating: 4100,
    baseStats: { topSpeed: 95, acceleration: 95, handling: 96, nitro: 93 },
    defaultCustomization: {
      bodyColor: '#ea580c',
      finish: 'metallic',
      rimColor: '#18181b',
      caliperColor: '#facc15',
      underglowColor: '#f59e0b',
    },
  },
  veloce_larossa: {
    id: 'veloce_larossa',
    name: 'Veloce LaRossa V12',
    carClass: 'HYPER',
    category: 'V12 Hybrid Flagship',
    brandOrigin: 'Maranello • Italy',
    engineType: 'italian-v12',
    engineLabel: '6.3L V12 HY-KERS',
    secondaryColor: '#111827',
    silhouette: 'veloce_larossa',
    tagline: 'F1-inspired splitter nose cone, transparent V12 glass bay, and active hydraulic rear airbrake wing.',
    price: 46500,
    basePowerRating: 4240,
    baseStats: { topSpeed: 96, acceleration: 96, handling: 95, nitro: 95 },
    defaultCustomization: {
      bodyColor: '#e11d48',
      finish: 'metallic',
      rimColor: '#cbd5e1',
      caliperColor: '#facc15',
      underglowColor: '#ef4444',
    },
  },
  modena_huayra: {
    id: 'modena_huayra',
    name: 'Modena Huayra R',
    carClass: 'HYPER',
    category: 'Atelier Carbon V12 Hypercar',
    brandOrigin: 'Modena • Italy',
    engineType: 'italian-v12',
    engineLabel: '6.0L V12-R 9000RPM',
    secondaryColor: '#1e293b',
    silhouette: 'modena_huayra',
    tagline: 'Elliptical headlights, four active carbon aero flaps, and signature quad center titanium exhausts.',
    price: 51000,
    basePowerRating: 4350,
    baseStats: { topSpeed: 96, acceleration: 95, handling: 97, nitro: 95 },
    defaultCustomization: {
      bodyColor: '#1e293b',
      finish: 'metallic',
      rimColor: '#b45309',
      caliperColor: '#facc15',
      underglowColor: '#f59e0b',
    },
  },
  molsheim_chiron: {
    id: 'molsheim_chiron',
    name: 'Molsheim Chiron Super Sport',
    carClass: 'HYPER',
    category: 'Quad-Turbo W16 Hyper-GT',
    brandOrigin: 'Molsheim • France',
    engineType: 'w16-quad-turbo',
    engineLabel: '8.0L W16 QUAD-TURBO',
    secondaryColor: '#0f172a',
    silhouette: 'molsheim_chiron',
    tagline: 'Iconic horseshoe grille, sweeping side C-line chrome arc, two-tone paint split, and 440+ KM/H W16 fury.',
    price: 56000,
    basePowerRating: 4460,
    baseStats: { topSpeed: 99, acceleration: 97, handling: 91, nitro: 97 },
    defaultCustomization: {
      bodyColor: '#2563eb',
      finish: 'metallic',
      rimColor: '#cbd5e1',
      caliperColor: '#38bdf8',
      underglowColor: '#06b6d4',
    },
  },
  angelholm_jesko: {
    id: 'angelholm_jesko',
    name: 'Angelholm Jesko Absolut',
    carClass: 'HYPER',
    category: 'Low-Drag Megacar',
    brandOrigin: 'Angelholm • Sweden',
    engineType: 'w16-quad-turbo',
    engineLabel: '5.0L TWIN-TURBO V8 1600HP',
    secondaryColor: '#0f172a',
    silhouette: 'angelholm_jesko',
    tagline: 'Wrap-around fighter-jet windshield, twin vertical rear stabilizer fins, and record-shattering top speed.',
    price: 61000,
    basePowerRating: 4550,
    baseStats: { topSpeed: 100, acceleration: 98, handling: 94, nitro: 97 },
    defaultCustomization: {
      bodyColor: '#e2e8f0',
      finish: 'metallic',
      rimColor: '#18181b',
      caliperColor: '#ef4444',
      underglowColor: '#06b6d4',
    },
  },
  molsheim_bolide: {
    id: 'molsheim_bolide',
    name: 'Molsheim Bolide Track',
    carClass: 'HYPER',
    category: 'Extreme W16 Track Hypercar',
    brandOrigin: 'Molsheim • France',
    engineType: 'w16-quad-turbo',
    engineLabel: '8.0L W16 1850HP TRACK',
    secondaryColor: '#0b0f19',
    silhouette: 'molsheim_bolide',
    tagline: 'Ultra-low track prototype with roof snorkel, front dive planes, and signature X-shaped LED taillights.',
    price: 68000,
    basePowerRating: 4680,
    baseStats: { topSpeed: 100, acceleration: 100, handling: 98, nitro: 99 },
    defaultCustomization: {
      bodyColor: '#06b6d4',
      finish: 'matte',
      rimColor: '#eab308',
      caliperColor: '#38bdf8',
      underglowColor: '#d946ef',
    },
  },
};

export const CAR_ORDER: CarId[] = [
  'civic_gt',
  'rally_hatch',
  'muscle_v8',
  'coupe_drift',
  'ingolstadt_rs6',
  'rally_raid',
  'yokohama_gtr',
  'marinelli_f40',
  'stuttgart_gt3rs',
  'vorsprung_r8',
  'scuderia_sf90',
  'santagata_svj',
  'woking_p1',
  'veloce_larossa',
  'modena_huayra',
  'molsheim_chiron',
  'angelholm_jesko',
  'molsheim_bolide',
];

// ==================== 5 EQUIPABLE CAR TOOLS ====================

export const CAR_TOOLS: Record<CarToolId, CarToolSpec> = {
  turbo: {
    id: 'turbo',
    name: 'Twin-Scroll Turbocharger',
    shortName: 'Twin Turbo',
    price: 900,
    powerRatingBonus: 95,
    effectSummary: 'Explosive off-the-line launch & +14% acceleration punch.',
    statBonuses: { acceleration: 8, topSpeed: 3 },
  },
  brakes: {
    id: 'brakes',
    name: 'Carbon-Ceramic Brake Kit',
    shortName: 'Carbon Brakes',
    price: 850,
    powerRatingBonus: 85,
    effectSummary: 'Late apex braking & sharper drift entry responsiveness.',
    statBonuses: { handling: 7 },
  },
  aero: {
    id: 'aero',
    name: 'Active Aero Wing & Diffuser',
    shortName: 'Active Aero',
    price: 1200,
    powerRatingBonus: 115,
    effectSummary: 'Mounts visible 3D GT carbon wing & adds high-speed downforce.',
    statBonuses: { topSpeed: 6, handling: 6 },
  },
  nitrous: {
    id: 'nitrous',
    name: 'Dual-Stage Nitrous System',
    shortName: 'Dual Nitrous',
    price: 1350,
    powerRatingBonus: 125,
    effectSummary: 'Unlocks early Purple Shockwave (75%+ Nitro) & faster recharge.',
    statBonuses: { nitro: 10, topSpeed: 3 },
  },
  slicks: {
    id: 'slicks',
    name: 'Racing Slick Tires',
    shortName: 'Racing Slicks',
    price: 1050,
    powerRatingBonus: 100,
    effectSummary: 'Maximum cornering traction & reduced shoulder drag.',
    statBonuses: { handling: 9, acceleration: 3 },
  },
};

export const CAR_TOOL_ORDER: CarToolId[] = ['turbo', 'brakes', 'aero', 'nitrous', 'slicks'];

// ==================== 6 SELECTABLE DRIVERS (ROOKIE TO PRO) ====================

const BASE_PERKS: DriverPerkModifiers = {
  baseCashMult: 1.0,
  driftNitroMult: 1.0,
  nitroDurationMult: 1.0,
  takedownCashMult: 1.0,
  collisionPowerMult: 1.0,
  gripMult: 1.0,
  offTrackRetention: 0.9,
  rampLaunchMult: 1.0,
  airTimeCashMult: 1.0,
};

export const DRIVER_CATALOG: Record<DriverId, DriverSpec> = {
  rookie: {
    id: 'rookie',
    name: 'Rookie Racer',
    nickname: 'Rookie',
    role: 'Balanced Street Challenger',
    price: 0,
    bio: 'Hungry newcomer climbing the underground street ladder with steady racecraft.',
    perkSummary: '+5% base race cash on every finish.',
    suitPrimary: '#e2e8f0',
    suitSecondary: '#f59e0b',
    helmetColor: '#0f172a',
    visorColor: '#38bdf8',
    perks: { ...BASE_PERKS, baseCashMult: 1.05 },
  },
  kenji: {
    id: 'kenji',
    name: 'Kenji "Sideways" Sato',
    nickname: 'Sideways',
    role: 'Drift Specialist',
    price: 1800,
    bio: 'Former Touge drift champion who converts extreme rear slip angles into relentless boost.',
    perkSummary: '+25% faster Nitro generation while drifting.',
    suitPrimary: '#0f172a',
    suitSecondary: '#06b6d4',
    helmetColor: '#06b6d4',
    visorColor: '#020617',
    perks: { ...BASE_PERKS, driftNitroMult: 1.25 },
  },
  elena: {
    id: 'elena',
    name: 'Elena Vance',
    nickname: 'Pulse',
    role: 'Nitro Tactician',
    price: 3200,
    bio: 'Telemetry prodigy who optimizes nitrous burn windows to sustain Shockwaves through straights.',
    perkSummary: '+20% longer Nitro & Shockwave boost duration.',
    suitPrimary: '#2e1065',
    suitSecondary: '#d946ef',
    helmetColor: '#f8fafc',
    visorColor: '#d946ef',
    perks: { ...BASE_PERKS, nitroDurationMult: 1.2 },
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus "Tank" Cole',
    nickname: 'Tank',
    role: 'Street Brawler',
    price: 4800,
    bio: 'Fearless heavy-contact racer known for smashing rivals into barriers at full boost.',
    perkSummary: '+50% cash on Rival Takedowns & stronger collision impact.',
    suitPrimary: '#450a0a',
    suitSecondary: '#ef4444',
    helmetColor: '#18181b',
    visorColor: '#f59e0b',
    perks: { ...BASE_PERKS, takedownCashMult: 1.5, collisionPowerMult: 1.38 },
  },
  sofia: {
    id: 'sofia',
    name: 'Sofia Rossi',
    nickname: 'Apex',
    role: 'Apex Master',
    price: 6500,
    bio: 'European GT circuit prodigy with surgical steering inputs and unmatched wet-weather grip.',
    perkSummary: '+15% cornering grip & reduced off-track speed penalty.',
    suitPrimary: '#064e3b',
    suitSecondary: '#eab308',
    helmetColor: '#10b981',
    visorColor: '#0f172a',
    perks: { ...BASE_PERKS, gripMult: 1.15, offTrackRetention: 0.98 },
  },
  jax: {
    id: 'jax',
    name: 'Jax Mercer',
    nickname: 'Air Ace',
    role: 'Stunt & Ramp Ace',
    price: 8500,
    bio: 'Adrenaline stunt pilot who hunts every jump ramp for massive airtime and explosive landings.',
    perkSummary: '+30% ramp launch speed & double Air-Time stunt cash.',
    suitPrimary: '#7c2d12',
    suitSecondary: '#fb923c',
    helmetColor: '#f97316',
    visorColor: '#e0f2fe',
    perks: { ...BASE_PERKS, rampLaunchMult: 1.3, airTimeCashMult: 2.0 },
  },
};

export const DRIVER_ORDER: DriverId[] = ['rookie', 'kenji', 'elena', 'marcus', 'sofia', 'jax'];

// ==================== 4 DISTINCT TRACK ENVIRONMENTS ====================

export const TRACK_CATALOG: Record<TrackId, TrackSpec> = {
  coastal: {
    id: 'coastal',
    name: 'Marina Coastal Causeway',
    subtitle: 'Waterside Causeway',
    laps: 3,
    roadWidth: 23,
    accentHex: '#0ea5e9',
    weatherLabel: 'Waterside Drop-Offs',
    description: 'Open-water coastal highway & drawbridges with breakable harbor bollards for splashdown ring-outs.',
  },
  desert: {
    id: 'desert',
    name: 'Red Canyon Gorge',
    subtitle: 'Desert Badlands',
    laps: 3,
    roadWidth: 22,
    accentHex: '#f97316',
    weatherLabel: 'Golden Canyon Sun',
    description: 'High-speed terracotta sandstone gorge with falling boulder hazards and ridge jump ramps.',
  },
  night: {
    id: 'night',
    name: 'Neo-Cyber Expressway',
    subtitle: 'Night Neon City',
    laps: 3,
    roadWidth: 23,
    accentHex: '#d946ef',
    weatherLabel: 'Rain & EMP Gates',
    description: 'Rain-slicked mirror tarmac flanked by glowing skyscrapers, neon arches, and pulsing EMP drone gates.',
  },
  alpine: {
    id: 'alpine',
    name: 'Alpine Glacier Pass',
    subtitle: 'Snow & Ice',
    laps: 3,
    roadWidth: 22,
    accentHex: '#38bdf8',
    weatherLabel: 'Black-Ice Peaks',
    description: 'High-altitude glacier switchbacks with glossy black-ice patches, pine forests, and crisp alpine fog.',
  },
};

export function normalizeTrackId(raw: string | null | undefined): TrackId {
  switch (raw) {
    case 'coastal':
    case 'marina_coast':
      return 'coastal';
    case 'desert':
    case 'red_canyon':
      return 'desert';
    case 'night':
    case 'cyber_metro':
      return 'night';
    case 'alpine':
    case 'alpine_peak':
      return 'alpine';
    default:
      return 'coastal';
  }
}

export interface CombatModSpec {
  id: CombatModId;
  name: string;
  shortName: string;
  price: number;
  description: string;
}

export const COMBAT_MODS: Record<CombatModId, CombatModSpec> = {
  none: {
    id: 'none',
    name: 'Standard Street Chassis',
    shortName: 'Stock',
    price: 0,
    description: 'Factory weight balance with no tactical combat modifier equipped.',
  },
  ram_chassis: {
    id: 'ram_chassis',
    name: 'Reinforced Ramming Chassis',
    shortName: 'Ram Chassis',
    price: 2200,
    description: '+35% side-shunt impact damage and -20% collision self-damage.',
  },
  emp_shockwave: {
    id: 'emp_shockwave',
    name: 'EMP Shockwave Emitter',
    shortName: 'EMP Emitter',
    price: 3400,
    description: 'Activating Shockwave releases a cyan EMP ring that stalls nearby rivals for 1.5s.',
  },
  fast_capacitor: {
    id: 'fast_capacitor',
    name: 'Fast-Charge Capacitor',
    shortName: 'Fast Cap',
    price: 2800,
    description: 'Cuts breakdown Energy Core recovery time by 50% and boosts Energy Pad gain by +40%.',
  },
};

export const COMBAT_MOD_ORDER: CombatModId[] = ['ram_chassis', 'emp_shockwave', 'fast_capacitor'];

export interface CupBossSpec {
  tournamentId: TournamentId;
  name: string;
  title: string;
  carId: CarId;
  bodyColor: string;
  rimColor: string;
  caliperColor: string;
  underglowColor: string;
  rewardCarId: CarId;
  skillMult: number;
}

export const CUP_BOSSES: Record<TournamentId, CupBossSpec> = {
  rookie_street: {
    tournamentId: 'rookie_street',
    name: 'Kuro "Drift King" Sato',
    title: 'Street Syndicate Boss',
    carId: 'coupe_drift',
    bodyColor: '#f43f5e',
    rimColor: '#fde047',
    caliperColor: '#ef4444',
    underglowColor: '#f43f5e',
    rewardCarId: 'coupe_drift',
    skillMult: 1.03,
  },
  coastal_drift: {
    tournamentId: 'coastal_drift',
    name: 'Marina "Tidebreaker" Cruz',
    title: 'Causeway Enforcer',
    carId: 'ingolstadt_rs6',
    bodyColor: '#0284c7',
    rimColor: '#e2e8f0',
    caliperColor: '#22d3ee',
    underglowColor: '#0ea5e9',
    rewardCarId: 'ingolstadt_rs6',
    skillMult: 1.05,
  },
  canyon_velocity: {
    tournamentId: 'canyon_velocity',
    name: 'Rex "Sandstorm" Vance',
    title: 'Badlands Warlord',
    carId: 'yokohama_gtr',
    bodyColor: '#ea580c',
    rimColor: '#18181b',
    caliperColor: '#facc15',
    underglowColor: '#f97316',
    rewardCarId: 'yokohama_gtr',
    skillMult: 1.07,
  },
  neon_metro: {
    tournamentId: 'neon_metro',
    name: 'Nyx "Cyber" Volkov',
    title: 'Neon Grid Phantom',
    carId: 'marinelli_f40',
    bodyColor: '#c026d3',
    rimColor: '#22d3ee',
    caliperColor: '#e879f9',
    underglowColor: '#d946ef',
    rewardCarId: 'marinelli_f40',
    skillMult: 1.08,
  },
  alpine_apex: {
    tournamentId: 'alpine_apex',
    name: 'Freya "Glacier" Lind',
    title: 'Alpine Apex Queen',
    carId: 'stuttgart_gt3rs',
    bodyColor: '#38bdf8',
    rimColor: '#f8fafc',
    caliperColor: '#38bdf8',
    underglowColor: '#22d3ee',
    rewardCarId: 'stuttgart_gt3rs',
    skillMult: 1.1,
  },
  hypercar_pro: {
    tournamentId: 'hypercar_pro',
    name: 'Enzo "Viper" Bellini',
    title: 'Hypercar Pro Champion',
    carId: 'scuderia_sf90',
    bodyColor: '#dc2626',
    rimColor: '#facc15',
    caliperColor: '#f59e0b',
    underglowColor: '#ef4444',
    rewardCarId: 'scuderia_sf90',
    skillMult: 1.12,
  },
  world_masters: {
    tournamentId: 'world_masters',
    name: 'Viktor "Titan" Kross',
    title: 'World Masters Titan',
    carId: 'veloce_larossa',
    bodyColor: '#facc15',
    rimColor: '#0f172a',
    caliperColor: '#ef4444',
    underglowColor: '#f59e0b',
    rewardCarId: 'veloce_larossa',
    skillMult: 1.14,
  },
  asphalt_legend: {
    tournamentId: 'asphalt_legend',
    name: 'Ares "Apex Zero" Moreau',
    title: 'Ultimate Asphalt Legend',
    carId: 'molsheim_bolide',
    bodyColor: '#111827',
    rimColor: '#22d3ee',
    caliperColor: '#22d3ee',
    underglowColor: '#06b6d4',
    rewardCarId: 'molsheim_bolide',
    skillMult: 1.16,
  },
};

export const TRACK_ORDER: TrackId[] = ['coastal', 'desert', 'night', 'alpine'];

// ==================== 8 PROGRESSIVE CAREER TOURNAMENTS (24 RACES) ====================

export const TOURNAMENT_CATALOG: Record<TournamentId, TournamentSpec> = {
  rookie_street: {
    id: 'rookie_street',
    order: 1,
    name: 'Rookie Street Series',
    allowedClasses: ['D', 'C', 'B', 'S', 'HYPER'],
    classLabel: 'Class D+',
    minPowerRating: 1000,
    tracks: ['coastal', 'desert', 'alpine'],
    aiDifficulty: 0.88,
    aiAggression: 0.55,
    prizeCash: 2200,
    trophyColor: '#7dd3fc',
    description: 'Opening 3-race street championship. Finish on the podium (1st–3rd) to advance.',
  },
  coastal_drift: {
    id: 'coastal_drift',
    order: 2,
    name: 'Coastal Drift Cup',
    allowedClasses: ['D', 'C', 'B', 'S', 'HYPER'],
    classLabel: 'Class D/C+',
    minPowerRating: 1320,
    tracks: ['coastal', 'night', 'coastal'],
    aiDifficulty: 0.94,
    aiAggression: 0.68,
    prizeCash: 3600,
    trophyColor: '#38bdf8',
    description: 'Long coastal sweepers and rain-slick neon corners demanding crisp nitro-drift chains.',
  },
  canyon_velocity: {
    id: 'canyon_velocity',
    order: 3,
    name: 'Canyon Velocity',
    allowedClasses: ['C', 'B', 'S', 'HYPER'],
    classLabel: 'Class C+',
    minPowerRating: 1750,
    tracks: ['desert', 'alpine', 'desert'],
    aiDifficulty: 1.0,
    aiAggression: 0.8,
    prizeCash: 5500,
    trophyColor: '#34d399',
    description: 'High-velocity canyon runs where Class C muscle, sport wagons, and drift coupes duel.',
  },
  neon_metro: {
    id: 'neon_metro',
    order: 4,
    name: 'Neon Metro Clash',
    allowedClasses: ['C', 'B', 'S', 'HYPER'],
    classLabel: 'Class C/B+',
    minPowerRating: 2100,
    tracks: ['night', 'coastal', 'night'],
    aiDifficulty: 1.06,
    aiAggression: 0.92,
    prizeCash: 8200,
    trophyColor: '#f59e0b',
    description: 'Midnight rain combat on wet expressways with aggressive blockers and ramp shortcuts.',
  },
  alpine_apex: {
    id: 'alpine_apex',
    order: 5,
    name: 'Alpine Apex',
    allowedClasses: ['B', 'S', 'HYPER'],
    classLabel: 'Class B+',
    minPowerRating: 2520,
    tracks: ['alpine', 'desert', 'alpine'],
    aiDifficulty: 1.12,
    aiAggression: 1.02,
    prizeCash: 12000,
    trophyColor: '#fbbf24',
    description: 'Technical glacier elevation changes demanding Class B GT-Rs, F40s, and GT3 RS grip.',
  },
  hypercar_pro: {
    id: 'hypercar_pro',
    order: 6,
    name: 'Hypercar Pro League',
    allowedClasses: ['B', 'S', 'HYPER'],
    classLabel: 'Class B/S/HYPER',
    minPowerRating: 2950,
    tracks: ['night', 'alpine', 'coastal'],
    aiDifficulty: 1.18,
    aiAggression: 1.12,
    prizeCash: 17500,
    trophyColor: '#c084fc',
    description: 'Pro-level sprint league featuring relentless Shockwave duels and brutal corner exit speeds.',
  },
  world_masters: {
    id: 'world_masters',
    order: 7,
    name: 'World Masters',
    allowedClasses: ['S', 'HYPER'],
    classLabel: 'Class S/HYPER',
    minPowerRating: 3450,
    tracks: ['desert', 'night', 'alpine'],
    aiDifficulty: 1.24,
    aiAggression: 1.24,
    prizeCash: 25000,
    trophyColor: '#e879f9',
    description: 'Elite world tour. Only tuned V10/V12 supercars and hypercars survive the pack.',
  },
  asphalt_legend: {
    id: 'asphalt_legend',
    order: 8,
    name: 'Ultimate Asphalt Legend',
    allowedClasses: ['S', 'HYPER'],
    classLabel: 'Class S / HYPER',
    minPowerRating: 3900,
    tracks: ['coastal', 'alpine', 'night'],
    aiDifficulty: 1.31,
    aiAggression: 1.35,
    prizeCash: 42000,
    trophyColor: '#facc15',
    description: 'The final crown of My Asphalt. W16 & V12 hypercars pushing 420+ KM/H to the checkered flag.',
  },
};

export const TOURNAMENT_ORDER: TournamentId[] = [
  'rookie_street',
  'coastal_drift',
  'canyon_velocity',
  'neon_metro',
  'alpine_apex',
  'hypercar_pro',
  'world_masters',
  'asphalt_legend',
];

export const AI_RIVALS: AIRivalProfile[] = [
  {
    id: 'ai-vex',
    name: 'Vex Morales',
    style: 'apex_drifter',
    styleLabel: 'Smooth Apex Drifter',
    carId: 'yokohama_gtr',
    bodyColor: '#06b6d4',
    rimColor: '#cbd5e1',
    caliperColor: '#38bdf8',
    underglowColor: '#06b6d4',
    baseSkill: 1.01,
  },
  {
    id: 'ai-sora',
    name: 'Sora Takahashi',
    style: 'sprinter',
    styleLabel: 'Top-Speed Sprinter',
    carId: 'scuderia_sf90',
    bodyColor: '#e11d48',
    rimColor: '#f8fafc',
    caliperColor: '#ef4444',
    underglowColor: '#ef4444',
    baseSkill: 1.03,
  },
  {
    id: 'ai-dante',
    name: 'Dante Novak',
    style: 'blocker',
    styleLabel: 'Aggressive Blocker',
    carId: 'ingolstadt_rs6',
    bodyColor: '#d97706',
    rimColor: '#18181b',
    caliperColor: '#facc15',
    underglowColor: '#f59e0b',
    baseSkill: 0.98,
  },
  {
    id: 'ai-kira',
    name: 'Kira Vance',
    style: 'precision',
    styleLabel: 'Precision Line Runner',
    carId: 'stuttgart_gt3rs',
    bodyColor: '#10b981',
    rimColor: '#eab308',
    caliperColor: '#22c55e',
    underglowColor: '#22c55e',
    baseSkill: 0.96,
  },
  {
    id: 'ai-nyx',
    name: 'Nyx Calder',
    style: 'nitro_opportunist',
    styleLabel: 'Shockwave Hunter',
    carId: 'molsheim_chiron',
    bodyColor: '#c026d3',
    rimColor: '#cbd5e1',
    caliperColor: '#d946ef',
    underglowColor: '#d946ef',
    baseSkill: 0.95,
  },
];

export const TOURNAMENT_POINTS_BY_PLACE: Record<number, number> = {
  1: 10,
  2: 6,
  3: 4,
  4: 2,
  5: 1,
  6: 0,
};

export const RACE_CASH_BY_PLACE: Record<number, number> = {
  1: 1500,
  2: 1050,
  3: 750,
  4: 500,
  5: 350,
  6: 220,
};

export const FASTEST_LAP_BONUS_CASH = 450;

export function getUpgradeCost(carId: CarId, currentLevel: number): number {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return 0;
  const spec = CAR_CATALOG[carId] ?? CAR_CATALOG.civic_gt;
  const classFactor: Record<CarClass, number> = {
    D: 1.0,
    C: 1.55,
    B: 2.35,
    S: 3.4,
    HYPER: 4.4,
  };
  return Math.round(400 * currentLevel * classFactor[spec.carClass]);
}

export function computeCarPerformance(
  carId: CarId,
  upgrades: UpgradeLevels,
  equippedTools: CarToolId[] = [],
  driverPerks: DriverPerkModifiers = BASE_PERKS
): ComputedCarPerformance {
  const spec = CAR_CATALOG[carId] ?? CAR_CATALOG.civic_gt;
  const safeUpgrades = upgrades ?? { topSpeed: 1, acceleration: 1, handling: 1, nitro: 1 };
  const hasTurbo = equippedTools.includes('turbo');
  const hasBrakes = equippedTools.includes('brakes');
  const hasAero = equippedTools.includes('aero');
  const hasNitrous = equippedTools.includes('nitrous');
  const hasSlicks = equippedTools.includes('slicks');

  let toolTop = 0;
  let toolAcc = 0;
  let toolHnd = 0;
  let toolNos = 0;
  let toolPr = 0;
  for (const tid of equippedTools) {
    const t = CAR_TOOLS[tid];
    toolTop += t.statBonuses.topSpeed ?? 0;
    toolAcc += t.statBonuses.acceleration ?? 0;
    toolHnd += t.statBonuses.handling ?? 0;
    toolNos += t.statBonuses.nitro ?? 0;
    toolPr += t.powerRatingBonus;
  }

  const upgradeSteps =
    (safeUpgrades.topSpeed - 1) +
    (safeUpgrades.acceleration - 1) +
    (safeUpgrades.handling - 1) +
    (safeUpgrades.nitro - 1);

  const powerRating = Math.round(spec.basePowerRating + upgradeSteps * 38 + toolPr);

  const topSpeedStat = Math.min(100, spec.baseStats.topSpeed + (safeUpgrades.topSpeed - 1) * 3.8 + toolTop);
  const accelStat = Math.min(100, spec.baseStats.acceleration + (safeUpgrades.acceleration - 1) * 3.8 + toolAcc);
  const handlingStat = Math.min(100, spec.baseStats.handling + (safeUpgrades.handling - 1) * 3.6 + toolHnd);
  const nitroStat = Math.min(100, spec.baseStats.nitro + (safeUpgrades.nitro - 1) * 4.0 + toolNos);

  // Calibrated Asphalt-style top speeds: ~262 km/h Class D up to ~360+ km/h Hyper base (~485 km/h Shockwave)
  const hyperBonusKmh = spec.carClass === 'HYPER' ? 20 : 0;
  const maxSpeedKmh = 180 + topSpeedStat * 1.52 + hyperBonusKmh + (hasAero ? 8 : 0);
  const maxSpeedMps = maxSpeedKmh / 3.6;
  const accelMps2 = (22 + accelStat * 0.25) * (hasTurbo ? 1.14 : 1.0);
  const steerRate = (1.68 + handlingStat * 0.0145) * (hasBrakes ? 1.07 : 1.0);
  const grip = (4.3 + handlingStat * 0.052) * (hasSlicks ? 1.16 : 1.0) * driverPerks.gripMult;
  const brakePower = hasBrakes ? 54 : 42;
  const driftChargeRate = (19 + nitroStat * 0.18) * (hasNitrous ? 1.22 : 1.0) * driverPerks.driftNitroMult;
  const nitroDrainRate = (25 / driverPerks.nitroDurationMult) * (hasNitrous ? 0.9 : 1.0);
  const nitroBoostMult = 1.22 + nitroStat * 0.0017;
  const shockwaveBoostMult = 1.34 + nitroStat * 0.002 + (hasNitrous ? 0.05 : 0);

  return {
    powerRating,
    maxSpeedKmh,
    maxSpeedMps,
    accelMps2,
    steerRate,
    grip,
    brakePower,
    driftChargeRate,
    nitroCapacity: 100,
    nitroDrainRate,
    nitroBoostMult,
    shockwaveBoostMult,
    shockwaveThreshold: hasNitrous ? 75 : 100,
    hasActiveAero: hasAero,
    hasDualNitrous: hasNitrous,
    hasRacingSlicks: hasSlicks,
    displayStats: {
      topSpeed: Math.round(topSpeedStat),
      acceleration: Math.round(accelStat),
      handling: Math.round(handlingStat),
      nitro: Math.round(nitroStat),
    },
  };
}

export function checkCarMeetsTournamentGate(
  carId: CarId,
  powerRating: number,
  tournamentId: TournamentId
): { eligible: boolean; reason: string | null } {
  const car = CAR_CATALOG[carId];
  const t = TOURNAMENT_CATALOG[tournamentId];
  if (!t.allowedClasses.includes(car.carClass)) {
    return {
      eligible: false,
      reason: `Requires ${t.classLabel} car (Current: Class ${car.carClass})`,
    };
  }
  if (powerRating < t.minPowerRating) {
    return {
      eligible: false,
      reason: `Requires ${t.minPowerRating} PR (Current: ${powerRating} PR)`,
    };
  }
  return { eligible: true, reason: null };
}

export function getPointsForPlace(place: number): number {
  return TOURNAMENT_POINTS_BY_PLACE[place] ?? 0;
}

export function getCashForPlace(place: number, difficultyMult = 1): number {
  const base = RACE_CASH_BY_PLACE[place] ?? 180;
  return Math.round(base * difficultyMult);
}

export function getNextTournamentId(current: TournamentId): TournamentId | null {
  const idx = TOURNAMENT_ORDER.indexOf(current);
  if (idx < 0 || idx >= TOURNAMENT_ORDER.length - 1) return null;
  return TOURNAMENT_ORDER[idx + 1];
}

export function sortStandings(standings: TournamentStanding[]): TournamentStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function createInitialStandings(
  playerName: string,
  playerCarId: CarId,
  playerBodyColor: string
): TournamentStanding[] {
  return [
    {
      racerId: 'player',
      name: playerName.trim() || 'Racer',
      isPlayer: true,
      carId: playerCarId,
      bodyColor: playerBodyColor,
      styleLabel: 'Player',
      points: 0,
      wins: 0,
    },
    ...AI_RIVALS.map((rival) => ({
      racerId: rival.id,
      name: rival.name,
      isPlayer: false,
      carId: rival.carId,
      bodyColor: rival.bodyColor,
      styleLabel: rival.styleLabel,
      points: 0,
      wins: 0,
    })),
  ];
}

export function createDefaultUpgrades(): Record<CarId, UpgradeLevels> {
  const result = {} as Record<CarId, UpgradeLevels>;
  for (const id of CAR_ORDER) {
    result[id] = { topSpeed: 1, acceleration: 1, handling: 1, nitro: 1 };
  }
  return result;
}

export function createDefaultToolsRecord(): Record<CarId, CarToolId[]> {
  const result = {} as Record<CarId, CarToolId[]>;
  for (const id of CAR_ORDER) {
    result[id] = [];
  }
  return result;
}

export const UPGRADE_LABELS: { key: UpgradeStatKey; label: string; short: string }[] = [
  { key: 'topSpeed', label: 'Top Speed', short: 'SPD' },
  { key: 'acceleration', label: 'Acceleration', short: 'ACC' },
  { key: 'handling', label: 'Handling', short: 'HND' },
  { key: 'nitro', label: 'Nitro', short: 'NOS' },
];
