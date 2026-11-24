import {
  AI_RIVALS,
  computeCarPerformance,
  CUP_BOSSES,
  DRIVER_CATALOG,
  FASTEST_LAP_BONUS_CASH,
  getCashForPlace,
  getNextTournamentId,
  getPointsForPlace,
  sortStandings,
  TOURNAMENT_CATALOG,
  TRACK_CATALOG,
} from './catalog';
import { getTrackData, sampleTrackAtDistance, type TrackData, wrapTrackDistance } from './tracks';
import type {
  ActiveTournamentState,
  CarId,
  DailyMutatorId,
  HudTelemetry,
  InputState,
  P2PNetState,
  PlayerProfile,
  RaceFinishEntry,
  RaceMode,
  RaceResultSummary,
  RaceStepEvents,
  RaceStuntStats,
  RacerState,
  SmashableBarrier,
  SplitPlayerTelemetry,
  StuntPopup,
  TournamentId,
  TournamentStanding,
  TrackId,
  TrackPickup,
  UpgradeLevels,
  WeatherTimeOfDay,
} from './types';

export interface RaceWorld {
  mode: RaceMode;
  weatherTime: WeatherTimeOfDay;
  dailyMutator?: DailyMutatorId;
  heatLevel: number;
  heliLockTimer: number | null;
  tournamentId?: TournamentId;
  raceIndex?: number;
  track: TrackData;
  totalLaps: number;
  aiDifficulty: number;
  aiAggression: number;
  phase: 'countdown' | 'racing' | 'slowmo_finish' | 'finished';
  countdownTimer: number;
  slowmoTimer: number;
  raceTime: number;
  eliminationTimer: number | null;
  rampageTimer: number | null;
  isBossFight: boolean;
  bossName: string | null;
  bossRewardCarId: CarId | null;
  combatBanner: string | null;
  combatBannerTimer: number;
  racers: RacerState[];
  pickups: TrackPickup[];
  smashables: SmashableBarrier[];
  stuntStats: RaceStuntStats;
  nextPopupId: number;
}

export interface CreateRaceOptions {
  mode: RaceMode;
  trackId: TrackId;
  weatherTime?: WeatherTimeOfDay;
  dailyMutator?: DailyMutatorId;
  profile: PlayerProfile;
  tournamentId?: TournamentId;
  raceIndex?: number;
  remotePeer?: {
    name: string;
    carId: CarId;
    bodyColor: string;
  };
}

const GRAVITY = 28;
const SLOWMO_DURATION = 1.55;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function signedTrackDelta(fromS: number, toS: number, totalLength: number): number {
  let diff = (toS - fromS) % totalLength;
  if (diff > totalLength * 0.5) diff -= totalLength;
  if (diff < -totalLength * 0.5) diff += totalLength;
  return diff;
}

export interface RubberBandParams {
  /** Positive when AI is ahead of player, negative when AI is behind player */
  gapMeters: number;
  /** Player current standing (1 = first .. 6 = last) */
  playerPlace: number;
  /** Overall race completion fraction 0..1 */
  raceProgress: number;
  /** Tournament AI aggression scalar (~0.55 .. 1.35) */
  aiAggression: number;
  /** Individual rival skill scalar */
  aiSkill: number;
}

export interface RubberBandResult {
  speedMult: number;
  accelMult: number;
  /** 0..1 urgency telling AI to burn Nitro earlier when trailing or in final lap battles */
  nitroUrgency: number;
}

/**
 * Dynamic rubber-banding model that keeps races competitive across all 8 career tiers
 * based on longitudinal gap, player standings, and race progress without artificial teleporting.
 */
export function computeDynamicRubberBand(params: RubberBandParams): RubberBandResult {
  const { gapMeters, playerPlace, raceProgress, aiAggression, aiSkill } = params;
  const progress = clamp(raceProgress, 0, 1);
  const place = clamp(playerPlace, 1, 6);
  const aggr = clamp(aiAggression, 0.5, 1.5);

  // Smooth bounded response to longitudinal gap: negative when AI is ahead, positive when behind
  const normalizedGap = Math.tanh(-gapMeters / 68);

  // Standing bias: if player leads (P1), rivals push harder; if player is P5/P6, pack eases slightly
  const standingBias =
    place === 1 ? 0.045 : place === 2 ? 0.02 : place >= 5 ? -0.045 : place === 4 ? -0.02 : 0;

  // Late-race tension multiplier: amplifies pack convergence smoothly on the final lap
  const lateTension = 1.0 + progress * 0.35;

  // Base speed multiplier driven by gap + standing + aggression
  const gapGain = normalizedGap >= 0 ? 0.115 * (0.85 + aggr * 0.25) : 0.105;
  const rawSpeedMult = 1.0 + (normalizedGap * gapGain + standingBias) * lateTension;
  const speedMult = clamp(rawSpeedMult, 0.84, 1.18);

  // Acceleration responds slightly faster so trailing rivals close corners cleanly
  const rawAccelMult = 1.0 + (normalizedGap * 0.15 + standingBias * 0.8) * lateTension;
  const accelMult = clamp(rawAccelMult, 0.9, 1.24);

  // Nitro urgency rises when AI is behind player, player is P1, or in final stretch
  const behindPressure = clamp(-gapMeters / 95, 0, 1);
  const closeDuel = Math.abs(gapMeters) < 28 ? 0.28 : 0;
  const skillBoost = clamp((aiSkill - 0.9) * 0.35, 0, 0.18);
  const nitroUrgency = clamp(
    behindPressure * 0.58 +
      closeDuel +
      progress * 0.26 +
      (place === 1 ? 0.14 : 0) +
      (aggr - 0.7) * 0.18 +
      skillBoost,
    0,
    1
  );

  return { speedMult, accelMult, nitroUrgency };
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function updateRacerWorldTransform(racer: RacerState, track: TrackData): void {
  const sample = sampleTrackAtDistance(track, racer.s);
  racer.worldPos = {
    x: sample.pos.x + sample.right.x * racer.d,
    y: sample.pos.y + racer.yOffset,
    z: sample.pos.z + sample.right.z * racer.d,
  };
  const trackYaw = Math.atan2(sample.tangent.x, sample.tangent.z);
  racer.worldYaw = trackYaw + racer.headingOffset + racer.driftAngle + racer.spinoutAngle;
}

function makeAiUpgrades(difficulty: number): UpgradeLevels {
  const lvl = clamp(Math.round(1 + (difficulty - 0.85) * 9.2), 1, 5);
  return { topSpeed: lvl, acceleration: lvl, handling: lvl, nitro: lvl };
}

function createEmptyStuntStats(): RaceStuntStats {
  return {
    driftBonusCash: 0,
    takedowns: 0,
    takedownCash: 0,
    airTimeSeconds: 0,
    airTimeCash: 0,
    nearMisses: 0,
    nearMissCash: 0,
    pickupCash: 0,
    cleanLaps: 0,
    cleanLapCash: 0,
    barriersSmashed: 0,
    stuntMultiplier: 1.0,
    totalStuntCash: 0,
  };
}

function recomputeStuntSummary(stats: RaceStuntStats): void {
  const rawStunts =
    stats.driftBonusCash +
    stats.takedownCash +
    stats.airTimeCash +
    stats.nearMissCash +
    stats.pickupCash +
    stats.cleanLapCash;

  const multSteps =
    stats.takedowns * 0.25 +
    stats.cleanLaps * 0.15 +
    Math.floor(stats.nearMisses / 2) * 0.1 +
    Math.floor(stats.airTimeSeconds / 2.2) * 0.1;

  stats.stuntMultiplier = Math.round(clamp(1.0 + multSteps, 1.0, 2.5) * 100) / 100;
  stats.totalStuntCash = Math.round(rawStunts * stats.stuntMultiplier);
}

function pushPopup(
  world: RaceWorld,
  popups: StuntPopup[],
  label: string,
  cash: number,
  color: StuntPopup['color']
): void {
  popups.push({
    id: world.nextPopupId++,
    label,
    cash,
    color,
  });
}

export function createRaceWorld(opts: CreateRaceOptions): RaceWorld {
  const track = getTrackData(opts.trackId);
  const trackSpec = TRACK_CATALOG[opts.trackId];
  const tournamentSpec = opts.tournamentId ? TOURNAMENT_CATALOG[opts.tournamentId] : null;
  const aiDifficulty = tournamentSpec ? tournamentSpec.aiDifficulty : 0.96;
  const aiAggression = tournamentSpec ? tournamentSpec.aiAggression : 0.72;

  const playerCarId = opts.profile.selectedCarId;
  const playerCustom = opts.profile.customizations[playerCarId];
  const playerDriver = DRIVER_CATALOG[opts.profile.selectedDriverId] ?? DRIVER_CATALOG.rookie;
  const playerTools = opts.profile.equippedTools[playerCarId] ?? [];
  const playerPerf = computeCarPerformance(
    playerCarId,
    opts.profile.upgrades[playerCarId],
    playerTools,
    playerDriver.perks
  );

  const gridSlots: { sBack: number; d: number }[] = [
    { sBack: 10, d: -3.2 },
    { sBack: 17, d: 3.2 },
    { sBack: 24, d: -3.2 },
    { sBack: 31, d: 3.2 },
    { sBack: 38, d: -3.2 },
    { sBack: 45, d: 3.2 },
  ];

  const racers: RacerState[] = [];
  const aiUpgrades = makeAiUpgrades(aiDifficulty);
  const aiHasAero = aiDifficulty >= 1.06;

  const isBossFight =
    opts.mode === 'tournament' &&
    Boolean(opts.tournamentId) &&
    opts.raceIndex === 2;
  const bossSpec = isBossFight && opts.tournamentId ? CUP_BOSSES[opts.tournamentId] : null;

  const baseCombatFields = {
    airSpinAngle: 0,
    airSpinRate: 0,
    airRollAngle: 0,
    airRollRate: 0,
    airRotationsCompleted: 0,
    integrity: 100,
    maxIntegrity: 100,
    isBrokenDown: false,
    breakdownTimer: 0,
    shuntCooldown: 0,
    shuntTimer: 0,
    shuntDir: 0,
    lastAttackerId: null as string | null,
    isDrowning: false,
    waterRecoveryTimer: 0,
    respawnImmunityTimer: 0,
    eliminated: false,
    empStallTimer: 0,
  };

  if (bossSpec) {
    const bossSlot = gridSlots[0];
    const bossPerf = computeCarPerformance(
      bossSpec.carId,
      makeAiUpgrades(aiDifficulty + 0.08),
      ['aero', 'turbo', 'nitrous']
    );
    const bossStartS = wrapTrackDistance(track.totalLength - bossSlot.sBack, track.totalLength);
    const bossRacer: RacerState = {
      ...baseCombatFields,
      id: `boss-${bossSpec.tournamentId}`,
      name: bossSpec.name,
      isPlayer: false,
      isBoss: true,
      carId: bossSpec.carId,
      bodyColor: bossSpec.bodyColor,
      finish: 'chameleon',
      rimColor: bossSpec.rimColor,
      caliperColor: bossSpec.caliperColor,
      underglowColor: bossSpec.underglowColor,
      hasActiveAero: true,
      styleLabel: bossSpec.title,
      aiStyle: 'blocker',
      aiSkill: clamp(bossSpec.skillMult * aiDifficulty, 0.96, 1.35),
      aiAggression: Math.max(1.2, aiAggression),
      perf: bossPerf,
      driverPerks: DRIVER_CATALOG.jax.perks,
      integrity: 115,
      maxIntegrity: 115,
      s: bossStartS,
      totalDistance: -bossSlot.sBack,
      d: bossSlot.d,
      headingOffset: 0,
      speed: 0,
      lateralSpeed: 0,
      yOffset: 0,
      vy: 0,
      isAirborne: false,
      currentAirTime: 0,
      rampCooldown: 0,
      steerAngle: 0,
      bodyRoll: 0,
      bodyPitch: 0,
      suspensionHeave: 0,
      brakeHeat: 0,
      driftAngle: 0,
      isDrifting: false,
      driftDirection: 0,
      currentDriftDistance: 0,
      isNitroActive: false,
      isShockwave: false,
      nitro: 55,
      boostTimer: 0,
      shieldTimer: 0,
      spinoutTimer: 0,
      spinoutAngle: 0,
      wheelSpin: 0,
      lapWallHits: 0,
      nearMissCooldowns: {},
      lap: 1,
      maxCheckpoint: 0,
      lapStartTime: 0,
      currentLapTime: 0,
      bestLapTime: null,
      finished: false,
      finishTime: null,
      place: 1,
      aiTargetOffset: bossSlot.d,
      aiLaneTimer: 1.2,
      worldPos: { x: 0, y: 0, z: 0 },
      worldYaw: 0,
    };
    updateRacerWorldTransform(bossRacer, track);
    racers.push(bossRacer);
  } else {
    // In splitscreen or p2p mode, replace slot 4 with Player 2 or Remote Peer so both humans start side-by-side!
    const aiCount = opts.mode === 'splitscreen' || opts.mode === 'p2p' ? 4 : 5;

    AI_RIVALS.slice(0, aiCount).forEach((rival, idx) => {
      const slot = gridSlots[idx];
      const aiTools = aiHasAero ? (['aero', 'turbo'] as const) : [];
      const basePerf = computeCarPerformance(rival.carId, aiUpgrades, [...aiTools]);
      const skillFactor = clamp(rival.baseSkill * aiDifficulty, 0.84, 1.32);

      const startS = wrapTrackDistance(track.totalLength - slot.sBack, track.totalLength);
      const racer: RacerState = {
        ...baseCombatFields,
        id: rival.id,
        name: opts.mode === 'pursuit' ? `Interceptor #${idx + 1}` : rival.name,
        isPlayer: false,
        isPolice: opts.mode === 'pursuit',
        spikeStripTimer: 0,
        carId: opts.mode === 'pursuit' ? 'ingolstadt_rs6' : rival.carId,
        bodyColor: opts.mode === 'pursuit' ? '#0f172a' : rival.bodyColor,
        finish: idx % 2 === 0 ? 'metallic' : 'matte',
        rimColor: rival.rimColor,
        caliperColor: rival.caliperColor,
        underglowColor: opts.mode === 'pursuit' ? '#3b82f6' : rival.underglowColor,
        hasActiveAero: aiHasAero,
        styleLabel: rival.styleLabel,
        aiStyle: rival.style,
        aiSkill: skillFactor,
        aiAggression,
        perf: basePerf,
        driverPerks: DRIVER_CATALOG.rookie.perks,
        s: startS,
        totalDistance: -slot.sBack,
        d: slot.d,
        headingOffset: 0,
        speed: 0,
        lateralSpeed: 0,
        yOffset: 0,
        vy: 0,
        isAirborne: false,
        currentAirTime: 0,
        rampCooldown: 0,
        steerAngle: 0,
        bodyRoll: 0,
        bodyPitch: 0,
        suspensionHeave: 0,
        brakeHeat: 0,
        driftAngle: 0,
        isDrifting: false,
        driftDirection: 0,
        currentDriftDistance: 0,
        isNitroActive: false,
        isShockwave: false,
        nitro: 42,
        boostTimer: 0,
        shieldTimer: 0,
        spinoutTimer: 0,
        spinoutAngle: 0,
        wheelSpin: 0,
        lapWallHits: 0,
        nearMissCooldowns: {},
        lap: 1,
        maxCheckpoint: 0,
        lapStartTime: 0,
        currentLapTime: 0,
        bestLapTime: null,
        finished: false,
        finishTime: null,
        place: idx + 1,
        aiTargetOffset: slot.d,
        aiLaneTimer: 1.5 + idx * 0.4,
        worldPos: { x: 0, y: 0, z: 0 },
        worldYaw: 0,
      };
      updateRacerWorldTransform(racer, track);
      racers.push(racer);
    });
  }

  // Add Player 2 (Split-Screen) or Remote Peer (Offline WebRTC P2P)
  if (opts.mode === 'splitscreen') {
    const p2Slot = gridSlots[4];
    const p2StartS = wrapTrackDistance(track.totalLength - p2Slot.sBack, track.totalLength);
    const p2Racer: RacerState = {
      id: 'player2',
      name: 'Player 2',
      isPlayer: false,
      isPlayer2: true,
      carId: playerCarId,
      bodyColor: '#e11d48',
      finish: 'metallic',
      rimColor: '#f8fafc',
      caliperColor: '#facc15',
      underglowColor: '#d946ef',
      hasActiveAero: playerPerf.hasActiveAero,
      styleLabel: 'Split P2',
      aiSkill: 1,
      aiAggression: 1,
      perf: playerPerf,
      driverPerks: playerDriver.perks,
      ...baseCombatFields,
      s: p2StartS,
      totalDistance: -p2Slot.sBack,
      d: p2Slot.d,
      headingOffset: 0,
      speed: 0,
      lateralSpeed: 0,
      yOffset: 0,
      vy: 0,
      isAirborne: false,
      currentAirTime: 0,
      rampCooldown: 0,
      steerAngle: 0,
      bodyRoll: 0,
      bodyPitch: 0,
      suspensionHeave: 0,
      brakeHeat: 0,
      driftAngle: 0,
      isDrifting: false,
      driftDirection: 0,
      currentDriftDistance: 0,
      isNitroActive: false,
      isShockwave: false,
      nitro: 45,
      boostTimer: 0,
      shieldTimer: 0,
      spinoutTimer: 0,
      spinoutAngle: 0,
      wheelSpin: 0,
      lapWallHits: 0,
      nearMissCooldowns: {},
      lap: 1,
      maxCheckpoint: 0,
      lapStartTime: 0,
      currentLapTime: 0,
      bestLapTime: null,
      finished: false,
      finishTime: null,
      place: 5,
      aiTargetOffset: 0,
      aiLaneTimer: 0,
      worldPos: { x: 0, y: 0, z: 0 },
      worldYaw: 0,
    };
    updateRacerWorldTransform(p2Racer, track);
    racers.push(p2Racer);
  } else if (opts.mode === 'p2p') {
    const peerSlot = gridSlots[4];
    const peerStartS = wrapTrackDistance(track.totalLength - peerSlot.sBack, track.totalLength);
    const peerCarId = opts.remotePeer?.carId ?? 'coupe_drift';
    const peerRacer: RacerState = {
      id: 'remote-peer',
      name: opts.remotePeer?.name ?? 'LAN Rival',
      isPlayer: false,
      isRemotePeer: true,
      carId: peerCarId,
      bodyColor: opts.remotePeer?.bodyColor ?? '#d946ef',
      finish: 'metallic',
      rimColor: '#f8fafc',
      caliperColor: '#22d3ee',
      underglowColor: '#22d3ee',
      hasActiveAero: true,
      styleLabel: 'Local P2P',
      aiSkill: 1,
      aiAggression: 1,
      perf: computeCarPerformance(peerCarId, aiUpgrades, ['aero']),
      driverPerks: DRIVER_CATALOG.rookie.perks,
      ...baseCombatFields,
      s: peerStartS,
      totalDistance: -peerSlot.sBack,
      d: peerSlot.d,
      headingOffset: 0,
      speed: 0,
      lateralSpeed: 0,
      yOffset: 0,
      vy: 0,
      isAirborne: false,
      currentAirTime: 0,
      rampCooldown: 0,
      steerAngle: 0,
      bodyRoll: 0,
      bodyPitch: 0,
      suspensionHeave: 0,
      brakeHeat: 0,
      driftAngle: 0,
      isDrifting: false,
      driftDirection: 0,
      currentDriftDistance: 0,
      isNitroActive: false,
      isShockwave: false,
      nitro: 45,
      boostTimer: 0,
      shieldTimer: 0,
      spinoutTimer: 0,
      spinoutAngle: 0,
      wheelSpin: 0,
      lapWallHits: 0,
      nearMissCooldowns: {},
      lap: 1,
      maxCheckpoint: 0,
      lapStartTime: 0,
      currentLapTime: 0,
      bestLapTime: null,
      finished: false,
      finishTime: null,
      place: 5,
      aiTargetOffset: 0,
      aiLaneTimer: 0,
      worldPos: { x: 0, y: 0, z: 0 },
      worldYaw: 0,
    };
    updateRacerWorldTransform(peerRacer, track);
    racers.push(peerRacer);
  }

  // Player 1 starts P6 (or P2 in 1v1 Boss Showdown)
  const playerSlot = bossSpec ? gridSlots[1] : gridSlots[5];
  const playerStartS = wrapTrackDistance(track.totalLength - playerSlot.sBack, track.totalLength);
  const playerRacer: RacerState = {
    ...baseCombatFields,
    id: 'player',
    name: opts.profile.playerName.trim() || playerDriver.name,
    isPlayer: true,
    combatMod: opts.profile.equippedCombatMod ?? 'none',
    rideHeight: playerCustom.rideHeight ?? 'stock',
    rimStyle: playerCustom.rimStyle ?? 'multi_spoke',
    spoilerStyle: playerCustom.spoilerStyle ?? 'gt_wing',
    carId: playerCarId,
    bodyColor: playerCustom.bodyColor,
    finish: playerCustom.finish,
    rimColor: playerCustom.rimColor,
    caliperColor: playerCustom.caliperColor,
    underglowColor: playerCustom.underglowColor,
    hasActiveAero: playerPerf.hasActiveAero,
    styleLabel: playerDriver.nickname,
    aiSkill: 1,
    aiAggression: 1,
    perf: playerPerf,
    driverPerks: playerDriver.perks,
    s: playerStartS,
    totalDistance: -playerSlot.sBack,
    d: playerSlot.d,
    headingOffset: 0,
    speed: 0,
    lateralSpeed: 0,
    yOffset: 0,
    vy: 0,
    isAirborne: false,
    currentAirTime: 0,
    rampCooldown: 0,
    steerAngle: 0,
    bodyRoll: 0,
    bodyPitch: 0,
    suspensionHeave: 0,
    brakeHeat: 0,
    driftAngle: 0,
    isDrifting: false,
    driftDirection: 0,
    currentDriftDistance: 0,
    isNitroActive: false,
    isShockwave: false,
    nitro: 45,
    boostTimer: 0,
    shieldTimer: 0,
    spinoutTimer: 0,
    spinoutAngle: 0,
    wheelSpin: 0,
    lapWallHits: 0,
    nearMissCooldowns: {},
    lap: 1,
    maxCheckpoint: 0,
    lapStartTime: 0,
    currentLapTime: 0,
    bestLapTime: null,
    finished: false,
    finishTime: null,
    place: bossSpec ? 2 : 6,
    aiTargetOffset: 0,
    aiLaneTimer: 0,
    worldPos: { x: 0, y: 0, z: 0 },
    worldYaw: 0,
  };
  updateRacerWorldTransform(playerRacer, track);
  racers.push(playerRacer);

  const pickups: TrackPickup[] = track.pickupTemplates.map((tpl) => ({
    ...tpl,
    collected: false,
    respawnTimer: 0,
  }));

  const smashables: SmashableBarrier[] = track.smashableTemplates.map((tpl) => ({
    ...tpl,
    smashed: false,
    respawnTimer: 0,
  }));

  const defaultWeather: WeatherTimeOfDay =
    opts.weatherTime ?? (opts.trackId === 'night' ? 'storm' : opts.trackId === 'desert' ? 'sunset' : 'noon');

  return {
    mode: opts.mode,
    weatherTime: defaultWeather,
    dailyMutator: opts.dailyMutator,
    heatLevel: opts.mode === 'pursuit' ? 1 : 0,
    heliLockTimer: null,
    tournamentId: opts.tournamentId,
    raceIndex: opts.raceIndex,
    track,
    totalLaps: opts.mode === 'elimination' ? 99 : opts.mode === 'rampage' ? 99 : trackSpec.laps,
    aiDifficulty,
    aiAggression,
    phase: 'countdown',
    countdownTimer: 2.7,
    slowmoTimer: 0,
    raceTime: 0,
    eliminationTimer: opts.mode === 'elimination' ? 20.0 : null,
    rampageTimer: opts.mode === 'rampage' ? 90.0 : null,
    isBossFight,
    bossName: bossSpec ? bossSpec.name : null,
    bossRewardCarId: bossSpec ? bossSpec.rewardCarId : null,
    combatBanner: null,
    combatBannerTimer: 0,
    racers,
    pickups,
    smashables,
    stuntStats: createEmptyStuntStats(),
    nextPopupId: 1,
  };
}

function computeAiInput(
  ai: RacerState,
  player: RacerState,
  world: RaceWorld,
  dt: number
): InputState {
  const track = world.track;
  const halfRoad = track.roadWidth * 0.5 - 2.3;
  const lookAhead = sampleTrackAtDistance(track, ai.s + 30);
  const farAhead = sampleTrackAtDistance(track, ai.s + 64);

  ai.aiLaneTimer -= dt;
  if (ai.aiLaneTimer <= 0) {
    ai.aiLaneTimer = 1.0 + Math.abs(Math.sin(world.raceTime * 1.3 + ai.s * 0.02)) * 1.4;
    const curveSign = Math.sign(lookAhead.curvature);
    if (ai.aiStyle === 'apex_drifter') {
      ai.aiTargetOffset = Math.abs(lookAhead.curvature) > 0.004 ? curveSign * (halfRoad * 0.65) : 0;
    } else if (ai.aiStyle === 'blocker') {
      const distToPlayer = signedTrackDelta(ai.s, player.s, track.totalLength);
      if (distToPlayer < 0 && distToPlayer > -38 && !player.finished) {
        ai.aiTargetOffset = clamp(player.d, -halfRoad * 0.78, halfRoad * 0.78);
      } else {
        ai.aiTargetOffset = clamp(Math.sin(ai.s * 0.015) * halfRoad * 0.5, -halfRoad, halfRoad);
      }
    } else if (ai.aiStyle === 'precision') {
      ai.aiTargetOffset = clamp(curveSign * halfRoad * 0.55, -halfRoad, halfRoad);
    } else if (ai.aiStyle === 'nitro_opportunist') {
      let bestOffset = 0;
      let nearest = 70;
      for (const pad of track.boostPads) {
        const ds = signedTrackDelta(ai.s, pad.s, track.totalLength);
        if (ds > 8 && ds < nearest) {
          nearest = ds;
          bestOffset = pad.d;
        }
      }
      ai.aiTargetOffset = clamp(bestOffset, -halfRoad, halfRoad);
    } else {
      ai.aiTargetOffset = clamp(Math.cos(ai.s * 0.012) * halfRoad * 0.45, -halfRoad, halfRoad);
    }
  }

  const desiredError = ai.aiTargetOffset - ai.d;
  const steerCmd = clamp(desiredError * 0.24 - ai.headingOffset * 1.8, -1, 1);

  const sharpCorner = Math.abs(lookAhead.curvature) > 0.0085 || Math.abs(farAhead.curvature) > 0.011;
  const shouldDrift =
    !ai.isAirborne &&
    ai.speed > 34 &&
    sharpCorner &&
    (ai.aiStyle === 'apex_drifter' || Math.abs(lookAhead.curvature) > 0.011);

  const totalRaceDist = Math.max(1, track.totalLength * world.totalLaps);
  const raceProgress = clamp(
    Math.max(player.totalDistance, ai.totalDistance) / totalRaceDist,
    0,
    1
  );
  const rb = computeDynamicRubberBand({
    gapMeters: ai.totalDistance - player.totalDistance,
    playerPlace: player.place,
    raceProgress,
    aiAggression: world.aiAggression,
    aiSkill: ai.aiSkill,
  });

  const isStraight = Math.abs(lookAhead.curvature) < 0.0055 && Math.abs(farAhead.curvature) < 0.0065;
  const baseThreshold = ai.aiStyle === 'nitro_opportunist' ? 28 : 44;
  // Higher nitroUrgency lowers threshold so rivals unleash boost to defend or chase late
  const nitroThreshold = Math.max(16, baseThreshold - rb.nitroUrgency * 22);
  const shouldNitro =
    ai.spinoutTimer <= 0 &&
    ((isStraight && ai.nitro > nitroThreshold) ||
      (rb.nitroUrgency > 0.72 && !sharpCorner && ai.nitro > 22) ||
      (ai.isNitroActive && ai.nitro > 8 && !sharpCorner));

  return {
    throttle: true,
    brake: sharpCorner && ai.speed > ai.perf.maxSpeedMps * 0.88 && !shouldDrift,
    left: steerCmd < -0.1,
    right: steerCmd > 0.1,
    drift: shouldDrift,
    nitro: shouldNitro,
  };
}

function interpolateRemotePeer(
  peer: RacerState,
  net: P2PNetState,
  track: TrackData,
  dt: number
): void {
  const alpha = Math.min(1, dt * 16);
  const ds = signedTrackDelta(peer.s, net.s, track.totalLength);
  peer.s = wrapTrackDistance(peer.s + ds * alpha, track.totalLength);
  peer.d += (net.d - peer.d) * alpha;
  peer.yOffset += (net.y - peer.yOffset) * alpha;
  peer.speed += (net.speed - peer.speed) * alpha;
  peer.steerAngle += (net.steer - peer.steerAngle) * alpha;
  peer.bodyRoll += (net.roll - peer.bodyRoll) * alpha;
  peer.bodyPitch += (net.pitch - peer.bodyPitch) * alpha;
  peer.isDrifting = net.drift;
  peer.isNitroActive = net.nitro;
  peer.isShockwave = net.shockwave;
  peer.shieldTimer = net.shield ? 1 : 0;
  peer.spinoutAngle = net.spinout;
  peer.lap = net.lap;
  peer.totalDistance = net.totalDistance;
  peer.finished = net.finished;
  peer.wheelSpin += (peer.speed / 0.38) * dt;

  const sample = sampleTrackAtDistance(track, peer.s);
  peer.worldPos = {
    x: sample.pos.x + sample.right.x * peer.d,
    y: sample.pos.y + peer.yOffset,
    z: sample.pos.z + sample.right.z * peer.d,
  };
  peer.worldYaw = lerpAngle(peer.worldYaw, net.yaw, alpha);
}

function updateRacerPhysics(
  racer: RacerState,
  input: InputState,
  world: RaceWorld,
  dt: number,
  player: RacerState,
  events: RaceStepEvents
): void {
  const track = world.track;
  const halfRoad = track.roadWidth * 0.5;
  const wallLimit = halfRoad - 1.3;
  const prevS = racer.s;
  const wasNitro = racer.isNitroActive;
  const wasShockwave = racer.isShockwave;

  racer.boostTimer = Math.max(0, racer.boostTimer - dt);
  racer.shieldTimer = Math.max(0, racer.shieldTimer - dt);
  racer.rampCooldown = Math.max(0, racer.rampCooldown - dt);
  racer.shuntCooldown = Math.max(0, racer.shuntCooldown - dt);
  racer.shuntTimer = Math.max(0, racer.shuntTimer - dt);
  racer.respawnImmunityTimer = Math.max(0, racer.respawnImmunityTimer - dt);
  racer.empStallTimer = Math.max(0, racer.empStallTimer - dt);
  racer.spikeStripTimer = Math.max(0, (racer.spikeStripTimer ?? 0) - dt);

  if (racer.eliminated) {
    racer.speed = Math.max(0, racer.speed - 25 * dt);
    updateRacerWorldTransform(racer, track);
    return;
  }

  // Waterside Splashdown Drowning & Air-Drop Recovery
  if (racer.isDrowning) {
    racer.waterRecoveryTimer -= dt;
    racer.vy -= GRAVITY * 0.85 * dt;
    racer.yOffset += racer.vy * dt;
    racer.speed = Math.max(0, racer.speed * (1 - dt * 2.5));
    racer.spinoutAngle += dt * 5.0;
    if (racer.waterRecoveryTimer <= 0) {
      racer.isDrowning = false;
      racer.d = 0;
      racer.yOffset = 2.4;
      racer.vy = 0;
      racer.isAirborne = true;
      racer.headingOffset = 0;
      racer.spinoutAngle = 0;
      racer.spinoutTimer = 0;
      racer.integrity = Math.round(racer.maxIntegrity * 0.65);
      racer.isBrokenDown = false;
      racer.respawnImmunityTimer = 1.5;
      racer.speed = Math.max(28, racer.perf.maxSpeedMps * 0.55);
    }
    updateRacerWorldTransform(racer, track);
    return;
  }

  if (racer.isPlayer) {
    for (const key of Object.keys(racer.nearMissCooldowns)) {
      racer.nearMissCooldowns[key] -= dt;
      if (racer.nearMissCooldowns[key] <= 0) {
        delete racer.nearMissCooldowns[key];
      }
    }
  }

  // Takedown spinout
  if (racer.spinoutTimer > 0) {
    racer.spinoutTimer = Math.max(0, racer.spinoutTimer - dt);
    racer.spinoutAngle += dt * 9.5;
    racer.speed = Math.max(12, racer.speed * (1 - dt * 1.45));
    if (racer.spinoutTimer === 0) {
      racer.spinoutAngle = 0;
    }
  } else if (Math.abs(racer.spinoutAngle) > 0.01) {
    racer.spinoutAngle += (0 - racer.spinoutAngle) * Math.min(1, dt * 10);
  }

  // Dynamic standing- & progress-aware rubber-banding for AI only (never for human P2/P2P)
  let rubberBandSpeed = 1.0;
  let rubberBandAccel = 1.0;
  if (!racer.isPlayer && !racer.isPlayer2 && !racer.isRemotePeer && !player.finished) {
    const totalRaceDist = Math.max(1, track.totalLength * world.totalLaps);
    const raceProgress = clamp(
      Math.max(player.totalDistance, racer.totalDistance) / totalRaceDist,
      0,
      1
    );
    const rb = computeDynamicRubberBand({
      gapMeters: racer.totalDistance - player.totalDistance,
      playerPlace: player.place,
      raceProgress,
      aiAggression: world.aiAggression,
      aiSkill: racer.aiSkill,
    });
    rubberBandSpeed = rb.speedMult;
    rubberBandAccel = rb.accelMult;
  }

  // Nitro & Purple Shockwave activation
  if (racer.spinoutTimer <= 0 && !racer.finished && input.nitro) {
    if (!racer.isNitroActive && racer.nitro >= racer.perf.shockwaveThreshold) {
      racer.isNitroActive = true;
      racer.isShockwave = true;
    } else if (!racer.isNitroActive && racer.nitro > 7) {
      racer.isNitroActive = true;
      racer.isShockwave = false;
    } else if (racer.isNitroActive && racer.nitro <= 0.5) {
      racer.isNitroActive = false;
      racer.isShockwave = false;
    }
  } else {
    racer.isNitroActive = false;
    racer.isShockwave = false;
  }

  if (racer.isPlayer) {
    if (racer.isShockwave && !wasShockwave) {
      events.playerShockwaveStarted = true;
      pushPopup(world, events.stuntPopups, 'SHOCKWAVE!', 0, 'fuchsia');
      // EMP Shockwave Emitter Combat Mod: stalls nearby rivals within 22m
      if (racer.combatMod === 'emp_shockwave') {
        events.empBlastTriggered = true;
        for (const other of world.racers) {
          if (other.id === racer.id || other.eliminated || other.isDrowning) continue;
          const ds = Math.abs(signedTrackDelta(racer.s, other.s, track.totalLength));
          if (ds < 22) {
            other.empStallTimer = 1.5;
            other.speed *= 0.68;
          }
        }
      }
    } else if (racer.isNitroActive && !wasNitro) {
      events.playerNitroStarted = true;
    }
    if (!racer.isNitroActive && wasNitro) {
      events.playerNitroEnded = true;
    }
  }

  // Support both digital keyboard and smooth analog Bluetooth gamepad steering/pedals
  const digitalSteer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const steerInput =
    typeof input.analogSteer === 'number' && Math.abs(input.analogSteer) > 0.04
      ? clamp(input.analogSteer, -1, 1)
      : digitalSteer;

  const throttleAmt =
    typeof input.analogThrottle === 'number' && input.analogThrottle > 0.05
      ? clamp(input.analogThrottle, 0, 1)
      : input.throttle
        ? 1
        : 0;

  const brakeAmt =
    typeof input.analogBrake === 'number' && input.analogBrake > 0.05
      ? clamp(input.analogBrake, 0, 1)
      : input.brake
        ? 1
        : 0;

  const canDrift =
    !racer.isAirborne &&
    racer.spinoutTimer <= 0 &&
    input.drift &&
    racer.speed > 20 &&
    (Math.abs(steerInput) > 0.1 || Math.abs(racer.driftAngle) > 0.08);

  if (canDrift) {
    if (!racer.isDrifting) {
      racer.isDrifting = true;
      racer.driftDirection = steerInput !== 0 ? Math.sign(steerInput) : Math.sign(racer.driftAngle) || 1;
    } else if (Math.abs(steerInput) > 0.1) {
      racer.driftDirection = Math.sign(steerInput);
    }
    const targetDriftAngle = -racer.driftDirection * 0.35;
    racer.driftAngle += (targetDriftAngle - racer.driftAngle) * Math.min(1, dt * 8.2);
    racer.nitro = clamp(racer.nitro + racer.perf.driftChargeRate * dt, 0, racer.perf.nitroCapacity);
    racer.currentDriftDistance += racer.speed * dt;

    if (racer.isPlayer && racer.currentDriftDistance >= 62) {
      racer.currentDriftDistance -= 62;
      const bonus = 175;
      world.stuntStats.driftBonusCash += bonus;
      recomputeStuntSummary(world.stuntStats);
      pushPopup(world, events.stuntPopups, 'MEGA DRIFT!', bonus, 'amber');
    }
  } else {
    if (racer.isPlayer && racer.isDrifting && racer.currentDriftDistance >= 28) {
      const bonus = Math.min(220, Math.round(racer.currentDriftDistance * 2.8));
      world.stuntStats.driftBonusCash += bonus;
      recomputeStuntSummary(world.stuntStats);
      pushPopup(world, events.stuntPopups, 'LONG DRIFT!', bonus, 'amber');
    }
    racer.isDrifting = false;
    racer.currentDriftDistance = 0;
    racer.driftAngle += (0 - racer.driftAngle) * Math.min(1, dt * 7.5);
  }

  // Tactical Side-Shunt (Lateral Slam)
  const shuntCooldownDuration = world.dailyMutator === 'infinite_shunt' ? 0.2 : 2.4;
  const shuntImpulse = world.dailyMutator === 'infinite_shunt' ? 36 : 24;
  if (
    input.shunt &&
    racer.shuntCooldown <= 0 &&
    !racer.isBrokenDown &&
    !racer.isAirborne &&
    !racer.finished
  ) {
    racer.shuntCooldown = shuntCooldownDuration;
    racer.shuntTimer = 0.26;
    racer.shuntDir = steerInput !== 0 ? Math.sign(steerInput) : racer.d >= 0 ? -1 : 1;
    if (racer.isPlayer) {
      events.playerShuntTriggered = true;
    }
  }
  if (racer.shuntTimer > 0) {
    racer.d += racer.shuntDir * shuntImpulse * dt;
  }

  // Breakdown State & Emergency Energy Core Regeneration
  if (racer.isBrokenDown) {
    const recoveryDuration = racer.combatMod === 'fast_capacitor' ? 1.5 : 3.0;
    const regenPerSec = 100 / recoveryDuration;
    racer.nitro = clamp(racer.nitro + regenPerSec * dt, 0, 100);
    racer.isNitroActive = false;
    racer.isShockwave = false;
    if (racer.nitro >= 100) {
      racer.isBrokenDown = false;
      racer.integrity = Math.round(racer.maxIntegrity * 0.65);
      racer.boostTimer = 1.25;
      racer.speed = Math.max(racer.speed, racer.perf.maxSpeedMps * 0.65);
      if (racer.isPlayer) {
        events.playerOverdriveRestart = true;
        pushPopup(world, events.stuntPopups, 'OVERDRIVE RESTART!', 0, 'cyan');
      }
    }
  }

  let targetMaxSpeed =
    racer.perf.maxSpeedMps *
    (racer.isPlayer || racer.isPlayer2 ? 1.0 : racer.aiSkill * rubberBandSpeed);
  let accelMult = racer.isPlayer || racer.isPlayer2 ? 1.0 : rubberBandAccel;

  if (racer.isBrokenDown) {
    targetMaxSpeed *= 0.25;
    accelMult *= 0.4;
  } else if (racer.empStallTimer > 0) {
    targetMaxSpeed *= 0.58;
    accelMult *= 0.55;
  }

  if (racer.isShockwave) {
    targetMaxSpeed *= racer.perf.shockwaveBoostMult;
    accelMult *= 1.85;
    racer.nitro = Math.max(0, racer.nitro - racer.perf.nitroDrainRate * 1.18 * dt);
  } else if (racer.isNitroActive) {
    targetMaxSpeed *= racer.perf.nitroBoostMult;
    accelMult *= 1.48;
    racer.nitro = Math.max(0, racer.nitro - racer.perf.nitroDrainRate * dt);
  } else {
    const mutatorRegen = world.dailyMutator === 'hyper_charge' ? 2.0 : 1.0;
    const passiveRegen = (racer.speed > 26 ? (racer.perf.hasDualNitrous ? 3.8 : 2.3) : 0.8) * mutatorRegen;
    racer.nitro = clamp(racer.nitro + passiveRegen * dt, 0, racer.perf.nitroCapacity);
  }

  if (racer.boostTimer > 0) {
    targetMaxSpeed *= 1.2;
    accelMult *= 1.55;
  }

  if (racer.isDrifting) {
    targetMaxSpeed *= 0.93;
  }

  const onShoulder = Math.abs(racer.d) > halfRoad - 2.4 && !racer.isAirborne;
  if (onShoulder) {
    const retention = racer.perf.hasRacingSlicks
      ? Math.max(racer.driverPerks.offTrackRetention, 0.96)
      : racer.driverPerks.offTrackRetention;
    targetMaxSpeed *= retention;
  }

  // Brake rotor thermal glow calculation
  const isHeavyBraking = brakeAmt > 0.15 && racer.speed > 10;
  if (isHeavyBraking) {
    racer.brakeHeat = clamp(racer.brakeHeat + dt * 2.8 * brakeAmt, 0, 1);
  } else {
    racer.brakeHeat = Math.max(0, racer.brakeHeat - dt * 1.35);
  }

  if (racer.finished) {
    racer.speed += (targetMaxSpeed * 0.52 - racer.speed) * Math.min(1, dt * 1.4);
  } else if (racer.spinoutTimer <= 0) {
    if (throttleAmt > 0.05) {
      const scaledMax = targetMaxSpeed * (0.45 + 0.55 * throttleAmt);
      if (racer.speed < scaledMax) {
        racer.speed = Math.min(scaledMax, racer.speed + racer.perf.accelMps2 * accelMult * throttleAmt * dt);
      } else {
        racer.speed += (scaledMax - racer.speed) * Math.min(1, dt * 2.6);
      }
    } else if (brakeAmt > 0.05) {
      racer.speed = Math.max(-12, racer.speed - racer.perf.brakePower * brakeAmt * dt);
    } else {
      const drag = 9.5;
      if (racer.speed > 0) {
        racer.speed = Math.max(0, racer.speed - drag * dt);
      } else if (racer.speed < 0) {
        racer.speed = Math.min(0, racer.speed + drag * dt);
      }
    }
  }

  // Steering & heading offset
  const airSteerFactor = racer.isAirborne ? 0.35 : 1.0;
  const speedSteerFactor = clamp(Math.abs(racer.speed) / 14, 0.25, 1.0) * airSteerFactor;
  const driftSteerBonus = racer.isDrifting ? 1.38 : 1.0;
  const steerDelta = -steerInput * racer.perf.steerRate * speedSteerFactor * driftSteerBonus * dt;

  const sample = sampleTrackAtDistance(track, racer.s);
  const curveKick = sample.curvature * racer.speed * dt;
  racer.headingOffset = clamp(racer.headingOffset + steerDelta + curveKick, -0.78, 0.78);

  const centeringStrength =
    (racer.isDrifting ? 2.1 : racer.perf.grip * 0.56) *
    (track.id === 'alpine' && Math.sin(racer.s * 0.045) > 0.65 ? 0.45 : 1.0);
  if (Math.abs(steerInput) < 0.05) {
    racer.headingOffset += (0 - racer.headingOffset) * Math.min(1, dt * centeringStrength);
  }

  // Articulated Vehicle Suspension Visuals (Front wheel steer, lateral roll, nose-dive on brake, rear-squat on Nitro)
  const targetSteerVisual = steerInput * 0.45;
  racer.steerAngle += (targetSteerVisual - racer.steerAngle) * Math.min(1, dt * 13);

  const targetRoll = -steerInput * clamp(racer.speed / 45, 0, 1) * (racer.isDrifting ? 0.145 : 0.095);
  racer.bodyRoll += (targetRoll - racer.bodyRoll) * Math.min(1, dt * 10);

  let targetPitch = 0;
  let targetHeave = 0;
  if (racer.isAirborne) {
    targetPitch = clamp(racer.vy * 0.022, -0.18, 0.28);
    targetHeave = 0.04;
  } else if (racer.isShockwave) {
    targetPitch = -0.072; // deep rear squat on Shockwave
    targetHeave = -0.035;
  } else if (racer.isNitroActive || racer.boostTimer > 0) {
    targetPitch = -0.048; // rear squat on Nitro
    targetHeave = -0.022;
  } else if (isHeavyBraking) {
    targetPitch = 0.068 * brakeAmt; // pronounced nose-dive on heavy braking
    targetHeave = -0.03 * brakeAmt;
  } else if (throttleAmt > 0.5 && racer.speed < racer.perf.maxSpeedMps * 0.45) {
    targetPitch = -0.026;
  }
  racer.bodyPitch += (targetPitch - racer.bodyPitch) * Math.min(1, dt * 9);
  racer.suspensionHeave += (targetHeave - racer.suspensionHeave) * Math.min(1, dt * 10);

  // Advance track-relative coordinates
  const forwardVel = racer.speed * Math.cos(racer.headingOffset);
  const lateralVel = -racer.speed * Math.sin(racer.headingOffset);

  racer.lateralSpeed = lateralVel;
  racer.s = wrapTrackDistance(racer.s + forwardVel * dt, track.totalLength);
  racer.totalDistance += forwardVel * dt;
  racer.d += lateralVel * dt;
  racer.wheelSpin += (racer.speed / 0.37) * dt;

  const gravScale = world.dailyMutator === 'low_gravity' ? 0.45 : 1.0;
  // Airborne & Jump Ramp Physics (including Barrel Rolls, Flat Spins & Vertical Takedowns)
  if (racer.isAirborne) {
    const prevY = racer.yOffset;
    racer.vy -= GRAVITY * gravScale * dt;
    racer.yOffset += racer.vy * dt;
    racer.currentAirTime += dt;

    if (racer.airRollRate !== 0) {
      racer.airRollAngle += racer.airRollRate * dt;
      const totalRolls = Math.floor(Math.abs(racer.airRollAngle) / (Math.PI * 2));
      if (totalRolls > racer.airRotationsCompleted) {
        racer.airRotationsCompleted = totalRolls;
        racer.nitro = clamp(racer.nitro + 40, 0, racer.perf.nitroCapacity);
        if (racer.isPlayer) {
          pushPopup(world, events.stuntPopups, 'BARREL ROLL! +40% NITRO', 150, 'fuchsia');
        }
      }
    }
    if (racer.airSpinRate !== 0) {
      racer.airSpinAngle += racer.airSpinRate * dt;
      const totalSpins = Math.floor(Math.abs(racer.airSpinAngle) / (Math.PI * 2));
      if (totalSpins > racer.airRotationsCompleted) {
        racer.airRotationsCompleted = totalSpins;
        racer.nitro = clamp(racer.nitro + 40, 0, racer.perf.nitroCapacity);
        if (racer.isPlayer) {
          pushPopup(world, events.stuntPopups, '360° FLAT SPIN! +40% NITRO', 150, 'cyan');
        }
      }
    }

    if (racer.yOffset <= 0) {
      racer.yOffset = 0;
      racer.vy = 0;
      racer.isAirborne = false;
      racer.airSpinAngle = 0;
      racer.airSpinRate = 0;
      racer.airRollAngle = 0;
      racer.airRollRate = 0;
      racer.airRotationsCompleted = 0;
      racer.suspensionHeave = -0.095; // landing suspension compression punch!
      racer.boostTimer = Math.max(racer.boostTimer, 0.75);

      // Vertical Takedown check when landing on a rival car
      if (prevY > 0.35 && racer.isPlayer) {
        for (const other of world.racers) {
          if (other.id === racer.id || other.eliminated || other.isDrowning) continue;
          const ds = Math.abs(signedTrackDelta(racer.s, other.s, track.totalLength));
          const dd = Math.abs(racer.d - other.d);
          if (ds < 5.0 && dd < 3.0) {
            other.integrity = 0;
            other.isBrokenDown = true;
            other.spinoutTimer = 1.4;
            other.speed *= 0.35;
            other.lastAttackerId = racer.id;
            racer.nitro = clamp(racer.nitro + 50, 0, racer.perf.nitroCapacity);
            world.stuntStats.takedowns += 1;
            world.stuntStats.takedownCash += 300;
            recomputeStuntSummary(world.stuntStats);
            if (world.mode === 'rampage' && world.rampageTimer !== null) {
              world.rampageTimer += 8.0;
            }
            events.playerTakedown = true;
            events.playerVerticalTakedown = true;
            events.hitStopSec = 0.04;
            world.combatBanner = 'VERTICAL TAKEDOWN! +50% NITRO';
            world.combatBannerTimer = 2.0;
            pushPopup(world, events.stuntPopups, 'VERTICAL TAKEDOWN!', 300, 'rose');
          }
        }
      }

      if (racer.isPlayer) {
        events.playerLanded = true;
        if (racer.currentAirTime >= 0.45) {
          const airCash = Math.round(racer.currentAirTime * 210 * racer.driverPerks.airTimeCashMult);
          world.stuntStats.airTimeSeconds += racer.currentAirTime;
          world.stuntStats.airTimeCash += airCash;
          recomputeStuntSummary(world.stuntStats);
          const label = racer.currentAirTime >= 1.1 ? 'MEGA AIR TIME!' : 'AIR TIME!';
          pushPopup(world, events.stuntPopups, label, airCash, 'cyan');
        }
      }
      racer.currentAirTime = 0;
    }
  } else if (racer.rampCooldown <= 0 && racer.speed > 22) {
    for (const ramp of track.ramps) {
      const ds = signedTrackDelta(racer.s, ramp.s, track.totalLength);
      const prevDs = signedTrackDelta(prevS, ramp.s, track.totalLength);
      const onRamp = Math.abs(ds) <= ramp.length * 0.52;
      const crossedCrest =
        prevDs >= -ramp.length * 0.5 && ds < -ramp.length * 0.35 && ds > -ramp.length * 1.1;

      if ((onRamp || crossedCrest) && Math.abs(racer.d - ramp.d) < ramp.width * 0.6) {
        const progress = clamp((ramp.length * 0.5 - ds) / ramp.length, 0, 1);
        racer.yOffset = Math.max(racer.yOffset, progress * ramp.height);
        racer.bodyPitch = 0.24;
        if (progress >= 0.58 || crossedCrest) {
          racer.isAirborne = true;
          racer.currentAirTime = 0;
          racer.airRotationsCompleted = 0;
          racer.airRollRate = ramp.isBarrelRoll ? Math.PI * 2.15 : 0;
          racer.airSpinRate = !ramp.isBarrelRoll && racer.isDrifting ? Math.PI * 2.15 : 0;
          racer.vy = (11.5 + racer.speed * 0.145) * racer.driverPerks.rampLaunchMult;
          racer.speed = Math.min(racer.perf.maxSpeedMps * 1.45, racer.speed * 1.07);
          racer.nitro = clamp(racer.nitro + 12, 0, racer.perf.nitroCapacity);
          racer.rampCooldown = 1.6;
          if (racer.isPlayer) {
            events.playerRampLaunched = true;
          }
        }
        break;
      }
    }
  }

  // Waterside Ring-Out (marina_coast / coastal) & Smooth Rail-Glide Wall Collision
  const isWatersideTrack = track.id === 'coastal';
  const pushedPastWaterEdge =
    isWatersideTrack &&
    !racer.isAirborne &&
    Math.abs(racer.d) > halfRoad + 1.1 &&
    (racer.shuntTimer > 0 || racer.spinoutTimer > 0 || Math.abs(racer.headingOffset) > 0.28);

  if (pushedPastWaterEdge) {
    racer.isDrowning = true;
    racer.waterRecoveryTimer = 2.5;
    racer.vy = -3.5;
    racer.integrity = 0;
    racer.isBrokenDown = true;
    updateRacerWorldTransform(racer, track);
    events.collisions.push({
      type: 'splashdown',
      intensity: 1.0,
      pos: { ...racer.worldPos },
      involvesPlayer: racer.isPlayer || racer.lastAttackerId === 'player',
    });
    if (racer.lastAttackerId === 'player' && !racer.isPlayer) {
      player.nitro = clamp(player.nitro + 50, 0, player.perf.nitroCapacity);
      world.stuntStats.takedowns += 1;
      world.stuntStats.takedownCash += 300;
      recomputeStuntSummary(world.stuntStats);
      if (world.mode === 'rampage' && world.rampageTimer !== null) {
        world.rampageTimer += 8.0;
        pushPopup(world, events.stuntPopups, '+8s SPLASHDOWN!', 300, 'cyan');
      } else {
        pushPopup(world, events.stuntPopups, 'SPLASHDOWN RING-OUT!', 300, 'cyan');
      }
      world.combatBanner = 'SPLASHDOWN RING-OUT! +50% ENERGY';
      world.combatBannerTimer = 2.2;
      events.playerSplashdown = true;
      events.playerTakedown = true;
    }
  } else if (Math.abs(racer.d) > wallLimit && !racer.isDrowning) {
    const sign = Math.sign(racer.d);
    const impactAngle = Math.abs(racer.headingOffset);
    racer.d = sign * wallLimit;
    racer.headingOffset *= 0.15;
    if (racer.shieldTimer <= 0) {
      const dragFactor = impactAngle > 0.24 ? 0.91 : 1 - dt * 1.1;
      racer.speed = Math.max(12, racer.speed * dragFactor);
      if (impactAngle > 0.22) {
        racer.lapWallHits += 1;
      }
    } else {
      racer.speed *= 0.99;
    }
    updateRacerWorldTransform(racer, track);
    if (racer.speed > 14 && impactAngle > 0.12) {
      events.collisions.push({
        type: 'wall',
        intensity: clamp(racer.speed / 65, 0.25, 1),
        pos: { ...racer.worldPos },
        involvesPlayer: racer.isPlayer,
      });
    }
  }

  // Speed Boost Pads
  if (!racer.isAirborne) {
    for (const pad of track.boostPads) {
      const ds = Math.abs(signedTrackDelta(racer.s, pad.s, track.totalLength));
      if (ds < pad.length * 0.55 && Math.abs(racer.d - pad.d) < pad.width * 0.58) {
        if (racer.boostTimer < 0.7) {
          racer.boostTimer = 1.15;
          racer.nitro = clamp(racer.nitro + 16, 0, racer.perf.nitroCapacity);
          if (racer.isPlayer) {
            events.playerBoostTriggered = true;
          }
        }
      }
    }
  }

  // On-Track 3D Pickups
  for (const pickup of world.pickups) {
    if (pickup.collected) continue;
    const ds = Math.abs(signedTrackDelta(racer.s, pickup.s, track.totalLength));
    const dy = Math.abs(racer.yOffset - Math.max(0, pickup.yOffset - 1.1));
    if (ds < 4.2 && Math.abs(racer.d - pickup.d) < 3.1 && dy < 2.8) {
      pickup.collected = true;
      pickup.respawnTimer = 13.5;

      if (pickup.kind === 'coin') {
        if (racer.isPlayer) {
          world.stuntStats.pickupCash += 150;
          recomputeStuntSummary(world.stuntStats);
          pushPopup(world, events.stuntPopups, 'CASH COIN!', 150, 'amber');
        }
      } else if (pickup.kind === 'nitro_blue') {
        const capBonus = racer.combatMod === 'fast_capacitor' ? 1.4 : 1.0;
        racer.nitro = clamp(racer.nitro + 32 * capBonus, 0, racer.perf.nitroCapacity);
        if (racer.isBrokenDown) {
          racer.integrity = Math.min(racer.maxIntegrity, racer.integrity + 25);
        }
        if (racer.isPlayer) {
          pushPopup(world, events.stuntPopups, '+32% ENERGY', 0, 'cyan');
        }
      } else if (pickup.kind === 'nitro_gold') {
        const capBonus = racer.combatMod === 'fast_capacitor' ? 1.4 : 1.0;
        racer.nitro = clamp(racer.nitro + 62 * capBonus, 0, racer.perf.nitroCapacity);
        if (racer.isBrokenDown) {
          racer.integrity = Math.min(racer.maxIntegrity, racer.integrity + 45);
        }
        if (racer.isPlayer) {
          world.stuntStats.pickupCash += 100;
          recomputeStuntSummary(world.stuntStats);
          pushPopup(world, events.stuntPopups, 'GOLD CORE!', 100, 'fuchsia');
        }
      } else if (pickup.kind === 'shield') {
        racer.shieldTimer = 8.5;
        if (racer.isPlayer) {
          pushPopup(world, events.stuntPopups, 'IMPACT SHIELD!', 0, 'emerald');
        }
      }

      if (racer.isPlayer) {
        events.playerPickupKind = pickup.kind;
      }
    }
  }

  // Smashable Trackside Barriers
  if (!racer.isAirborne) {
    for (const barrier of world.smashables) {
      if (barrier.smashed) continue;
      const ds = Math.abs(signedTrackDelta(racer.s, barrier.s, track.totalLength));
      if (ds < 3.2 && Math.abs(racer.d - barrier.d) < 2.6) {
        barrier.smashed = true;
        barrier.respawnTimer = 18;
        racer.nitro = clamp(racer.nitro + 9, 0, racer.perf.nitroCapacity);
        events.collisions.push({
          type: 'smash',
          intensity: 0.72,
          pos: { ...barrier.pos },
          involvesPlayer: racer.isPlayer,
        });
        if (racer.isPlayer) {
          world.stuntStats.barriersSmashed += 1;
          world.stuntStats.pickupCash += 75;
          recomputeStuntSummary(world.stuntStats);
          pushPopup(world, events.stuntPopups, 'BARRIER SMASH!', 75, 'amber');
        }
      }
    }
  }

  // Checkpoint & Lap Progression
  const progressFrac = racer.s / track.totalLength;
  if (progressFrac > 0.25 && progressFrac < 0.55 && racer.maxCheckpoint === 0) {
    racer.maxCheckpoint = 1;
  } else if (progressFrac >= 0.55 && progressFrac < 0.85 && racer.maxCheckpoint === 1) {
    racer.maxCheckpoint = 2;
  }

  const crossedFinish =
    prevS > track.totalLength * 0.78 && racer.s < track.totalLength * 0.22 && forwardVel > 0;
  if (crossedFinish && racer.maxCheckpoint >= 2) {
    const lapTime = world.raceTime - racer.lapStartTime;
    if (racer.bestLapTime === null || lapTime < racer.bestLapTime) {
      racer.bestLapTime = lapTime;
    }

    if (racer.isPlayer) {
      events.playerCompletedLapTime = lapTime;
      if (racer.lapWallHits === 0) {
        world.stuntStats.cleanLaps += 1;
        world.stuntStats.cleanLapCash += 250;
        recomputeStuntSummary(world.stuntStats);
        pushPopup(world, events.stuntPopups, 'CLEAN LAP!', 250, 'emerald');
      }
    }

    racer.lapWallHits = 0;
    racer.lapStartTime = world.raceTime;
    racer.maxCheckpoint = 0;

    if (racer.lap >= world.totalLaps) {
      if (!racer.finished) {
        racer.finished = true;
        racer.finishTime = world.raceTime;
        if (racer.isPlayer) {
          events.playerFinished = true;
        }
      }
    } else {
      racer.lap += 1;
      if (racer.isPlayer) {
        events.playerLapCompleted = true;
      }
    }
  }

  racer.currentLapTime = racer.finished
    ? (racer.finishTime ?? world.raceTime) - racer.lapStartTime
    : world.raceTime - racer.lapStartTime;

  updateRacerWorldTransform(racer, track);
}

function resolveCarCollisionsAndNearMisses(world: RaceWorld, events: RaceStepEvents): void {
  const racers = world.racers;
  const trackLen = world.track.totalLength;
  const halfRoad = world.track.roadWidth * 0.5 - 1.35;

  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i];
      const b = racers[j];

      if (Math.abs(a.yOffset - b.yOffset) > 2.2) continue;

      const ds = signedTrackDelta(a.s, b.s, trackLen);
      const dd = b.d - a.d;
      const absDs = Math.abs(ds);
      const absDd = Math.abs(dd);

      if (absDs < 4.4 && absDd < 2.35) {
        const pushSign = dd >= 0 ? 1 : -1;
        const overlapD = (2.35 - absDd) * 0.55;
        if (!a.isRemotePeer) a.d = clamp(a.d - pushSign * overlapD, -halfRoad, halfRoad);
        if (!b.isRemotePeer) b.d = clamp(b.d + pushSign * overlapD, -halfRoad, halfRoad);

        const midPos = {
          x: (a.worldPos.x + b.worldPos.x) * 0.5,
          y: (a.worldPos.y + b.worldPos.y) * 0.5 + 0.6,
          z: (a.worldPos.z + b.worldPos.z) * 0.5,
        };

        const player = a.isPlayer ? a : b.isPlayer ? b : null;
        const rival = a.isPlayer ? b : b.isPlayer ? a : null;

        // Kinetic Collision Damage & Shunt / Shockwave Slam
        if (!a.isDrowning && !b.isDrowning && !a.eliminated && !b.eliminated) {
          const relSpeed = Math.abs(a.speed - b.speed);
          const aBoost = (a.isShockwave ? 2.2 : a.isNitroActive ? 1.35 : 1.0) * (a.shuntTimer > 0 ? 1.65 : 1.0) * (a.combatMod === 'ram_chassis' ? 1.35 : 1.0);
          const bBoost = (b.isShockwave ? 2.2 : b.isNitroActive ? 1.35 : 1.0) * (b.shuntTimer > 0 ? 1.65 : 1.0) * (b.combatMod === 'ram_chassis' ? 1.35 : 1.0);
          const baseDmg = 10 + relSpeed * 0.55;

          if (b.respawnImmunityTimer <= 0 && b.shieldTimer <= 0 && !b.isRemotePeer) {
            const selfRed = b.combatMod === 'ram_chassis' ? 0.8 : 1.0;
            b.integrity = Math.max(0, b.integrity - baseDmg * aBoost * selfRed);
            b.lastAttackerId = a.id;
            if (a.shuntTimer > 0) {
              b.d += pushSign * 2.8;
            }
          }
          if (a.respawnImmunityTimer <= 0 && a.shieldTimer <= 0 && !a.isRemotePeer) {
            const selfRed = a.combatMod === 'ram_chassis' ? 0.8 : 1.0;
            a.integrity = Math.max(0, a.integrity - baseDmg * bBoost * selfRed);
            a.lastAttackerId = b.id;
            if (b.shuntTimer > 0) {
              a.d -= pushSign * 2.8;
            }
          }

          if (player && rival && rival.integrity <= 0 && !rival.isBrokenDown) {
            rival.isBrokenDown = true;
            rival.nitro = 0;
            rival.spinoutTimer = 1.25;
            rival.speed *= 0.42;
            player.nitro = clamp(player.nitro + 35, 0, player.perf.nitroCapacity);
            world.stuntStats.takedowns += 1;
            world.stuntStats.takedownCash += 250;
            recomputeStuntSummary(world.stuntStats);
            if (world.mode === 'rampage' && world.rampageTimer !== null) {
              world.rampageTimer += 8.0;
              pushPopup(world, events.stuntPopups, '+8s WRECKED RIVAL!', 250, 'rose');
            } else {
              pushPopup(world, events.stuntPopups, 'WRECKED RIVAL! +35% NITRO', 250, 'rose');
            }
            world.combatBanner = 'WRECKED RIVAL! +35% NITRO & +$250';
            world.combatBannerTimer = 2.0;
            events.playerTakedown = true;
            events.hitStopSec = 0.04;
          } else if (player && player.integrity <= 0 && !player.isBrokenDown) {
            player.isBrokenDown = true;
            player.nitro = 0;
            player.spinoutTimer = 1.1;
            world.combatBanner = 'CHASSIS BROKEN DOWN! RECHARGING...';
            world.combatBannerTimer = 2.4;
          }
        }

        if (
          player &&
          rival &&
          rival.spinoutTimer <= 0 &&
          (player.isShockwave ||
            player.isNitroActive ||
            player.shieldTimer > 0 ||
            player.shuntTimer > 0 ||
            (player.driverPerks.collisionPowerMult > 1.2 && player.speed > rival.speed + 4))
        ) {
          rival.spinoutTimer = 1.4;
          rival.speed *= 0.52;
          if (!rival.isRemotePeer) {
            const maxLateral = world.track.id === 'coastal' ? halfRoad + 2.8 : halfRoad;
            rival.d = clamp(rival.d + (rival.d >= player.d ? 2.6 : -2.6), -maxLateral, maxLateral);
          }
          player.nitro = clamp(player.nitro + 25, 0, player.perf.nitroCapacity);
          player.boostTimer = Math.max(player.boostTimer, 0.75);

          const takedownCash = Math.round(300 * player.driverPerks.takedownCashMult);
          world.stuntStats.takedowns += 1;
          world.stuntStats.takedownCash += takedownCash;
          recomputeStuntSummary(world.stuntStats);
          if (world.mode === 'rampage' && world.rampageTimer !== null) {
            world.rampageTimer += 8.0;
          }

          events.playerTakedown = true;
          events.hitStopSec = Math.max(events.hitStopSec, 0.04);
          pushPopup(world, events.stuntPopups, 'RIVAL TAKEDOWN!', takedownCash, 'rose');
          events.collisions.push({
            type: 'takedown',
            intensity: 1.0,
            pos: midPos,
            involvesPlayer: true,
          });
        } else {
          const avgSpeed = (a.speed + b.speed) * 0.5;
          if (a.shieldTimer <= 0 && !a.isRemotePeer) a.speed = avgSpeed * 0.94;
          if (b.shieldTimer <= 0 && !b.isRemotePeer) b.speed = avgSpeed * 0.94;

          events.collisions.push({
            type: 'car',
            intensity: clamp(Math.abs(a.speed - b.speed) / 35 + 0.35, 0.3, 1),
            pos: midPos,
            involvesPlayer: a.isPlayer || b.isPlayer,
          });
        }
      } else if (a.isPlayer || b.isPlayer) {
        const player = a.isPlayer ? a : b;
        const rival = a.isPlayer ? b : a;
        if (
          !player.finished &&
          player.speed > 42 &&
          absDs < 5.0 &&
          absDd >= 2.35 &&
          absDd < 3.6 &&
          !player.nearMissCooldowns[rival.id]
        ) {
          player.nearMissCooldowns[rival.id] = 3.8;
          player.nitro = clamp(player.nitro + 10, 0, player.perf.nitroCapacity);
          world.stuntStats.nearMisses += 1;
          world.stuntStats.nearMissCash += 100;
          recomputeStuntSummary(world.stuntStats);
          pushPopup(world, events.stuntPopups, 'NEAR MISS!', 100, 'cyan');
        }
      }
    }
  }
}

function updatePlaces(world: RaceWorld): void {
  const ordered = [...world.racers].sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishTime ?? 0) - (b.finishTime ?? 0);
    }
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.totalDistance - a.totalDistance;
  });

  ordered.forEach((racer, idx) => {
    racer.place = idx + 1;
  });
}

export function stepRaceWorld(
  world: RaceWorld,
  playerInput: InputState,
  dtRaw: number,
  player2Input?: InputState,
  remotePeerState?: P2PNetState | null
): RaceStepEvents {
  const dt = Math.min(Math.max(dtRaw, 0), 0.05);
  const events: RaceStepEvents = {
    collisions: [],
    playerBoostTriggered: false,
    playerRampLaunched: false,
    playerLanded: false,
    playerPickupKind: null,
    playerLapCompleted: false,
    playerCompletedLapTime: null,
    playerFinished: false,
    playerNitroStarted: false,
    playerShockwaveStarted: false,
    playerNitroEnded: false,
    playerTakedown: false,
    playerSplashdown: false,
    playerVerticalTakedown: false,
    playerOverdriveRestart: false,
    playerShuntTriggered: false,
    eliminationBoom: false,
    empBlastTriggered: false,
    hitStopSec: 0,
    stuntPopups: [],
  };

  if (world.phase === 'countdown') {
    world.countdownTimer -= dt;
    if (world.countdownTimer <= 0) {
      world.countdownTimer = 0;
      world.phase = 'racing';
      for (const r of world.racers) {
        r.lapStartTime = 0;
      }
    }
    return events;
  }

  if (world.phase === 'finished') {
    return events;
  }

  for (const p of world.pickups) {
    if (p.collected) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        p.collected = false;
        p.respawnTimer = 0;
      }
    }
  }
  for (const b of world.smashables) {
    if (b.smashed) {
      b.respawnTimer -= dt;
      if (b.respawnTimer <= 0) {
        b.smashed = false;
        b.respawnTimer = 0;
      }
    }
  }

  const effectiveDt = world.phase === 'slowmo_finish' ? dt * 0.28 : dt;
  world.raceTime += effectiveDt;

  const player = world.racers.find((r) => r.isPlayer)!;
  const fallbackIdle: InputState = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    drift: false,
    nitro: false,
  };

  for (const racer of world.racers) {
    if (racer.isRemotePeer && remotePeerState) {
      interpolateRemotePeer(racer, remotePeerState, world.track, effectiveDt);
      if (remotePeerState.takedownHit && player.spinoutTimer <= 0 && player.shieldTimer <= 0) {
        player.spinoutTimer = 1.0;
        player.speed *= 0.65;
      }
      continue;
    }

    const input = racer.isPlayer
      ? world.phase === 'slowmo_finish'
        ? { throttle: true, brake: false, left: false, right: false, drift: false, nitro: false }
        : playerInput
      : racer.isPlayer2
        ? player2Input ?? fallbackIdle
        : computeAiInput(racer, player, world, effectiveDt);
    updateRacerPhysics(racer, input, world, effectiveDt, player, events);
  }

  resolveCarCollisionsAndNearMisses(world, events);
  updatePlaces(world);

  if (world.combatBannerTimer > 0) {
    world.combatBannerTimer = Math.max(0, world.combatBannerTimer - dt);
    if (world.combatBannerTimer === 0) {
      world.combatBanner = null;
    }
  }

  // Biome-Specific Dynamic Track Hazards (Drawbridge, Rockslides, EMP Gates)
  if (world.phase === 'racing') {
    for (const r of world.racers) {
      if (r.eliminated || r.isDrowning) continue;
      if (world.track.id === 'coastal' && r.lap >= 2) {
        const bridgeS = world.track.totalLength * 0.52;
        if (Math.abs(signedTrackDelta(r.s, bridgeS, world.track.totalLength)) < 5.5 && !r.isAirborne && r.speed < 58) {
          r.isDrowning = true;
          r.waterRecoveryTimer = 2.5;
          r.vy = -3.0;
          r.integrity = 0;
          r.isBrokenDown = true;
          events.collisions.push({
            type: 'splashdown',
            intensity: 1.0,
            pos: { ...r.worldPos },
            involvesPlayer: r.isPlayer,
          });
        }
      } else if (world.track.id === 'desert' && !r.isAirborne && !r.isShockwave) {
        const rockS = world.track.totalLength * 0.44;
        if (Math.abs(signedTrackDelta(r.s, rockS, world.track.totalLength)) < 3.5 && Math.abs(r.d) < 3.5 && r.respawnImmunityTimer <= 0) {
          r.speed *= 0.85;
          r.integrity = Math.max(0, r.integrity - 14 * dt * 10);
          r.respawnImmunityTimer = 0.6;
        }
      } else if (world.track.id === 'night' && !r.isAirborne) {
        const empS = world.track.totalLength * 0.62;
        const empActive = Math.sin(world.raceTime * 2.1) > 0.2;
        if (Math.abs(signedTrackDelta(r.s, empS, world.track.totalLength)) < 3.2 && r.respawnImmunityTimer <= 0) {
          if (r.isNitroActive || r.isShockwave) {
            r.nitro = clamp(r.nitro + 20, 0, r.perf.nitroCapacity);
            r.respawnImmunityTimer = 1.0;
          } else if (empActive) {
            r.nitro = Math.max(0, r.nitro - 30);
            r.speed *= 0.78;
            r.respawnImmunityTimer = 1.0;
          }
        }
      }
    }

    // Elimination Mode: 20s countdown eliminates last-place racer
    if (world.mode === 'elimination' && world.eliminationTimer !== null) {
      world.eliminationTimer -= effectiveDt;
      if (world.eliminationTimer <= 0) {
        const survivors = world.racers.filter((r) => !r.eliminated).sort((a, b) => b.totalDistance - a.totalDistance);
        if (survivors.length > 1) {
          const victim = survivors[survivors.length - 1];
          victim.eliminated = true;
          victim.integrity = 0;
          victim.isBrokenDown = true;
          events.eliminationBoom = true;
          events.collisions.push({
            type: 'takedown',
            intensity: 1.0,
            pos: { ...victim.worldPos },
            involvesPlayer: true,
          });
          world.combatBanner = `${victim.name.toUpperCase()} ELIMINATED!`;
          world.combatBannerTimer = 2.2;
          pushPopup(world, events.stuntPopups, `${victim.name} ELIMINATED!`, 0, 'rose');

          const remaining = survivors.length - 1;
          if (victim.isPlayer || remaining <= 1) {
            player.finished = true;
            player.finishTime = world.raceTime;
          }
        }
        world.eliminationTimer = 20.0;
      }
    }

    // Rampage Mode: 90s countdown; rank by takedowns when timer hits 0
    if (world.mode === 'rampage' && world.rampageTimer !== null) {
      world.rampageTimer = Math.max(0, world.rampageTimer - effectiveDt);
      if (world.rampageTimer <= 0 && !player.finished) {
        player.finished = true;
        player.finishTime = world.raceTime;
      }
    }

    // Police Pursuit Mode: Escalating Heat 1..5, Spike Strips (Heat 2+), EMP Heli Lock-On (Heat 4+)
    if (world.mode === 'pursuit') {
      world.heatLevel = clamp(
        1 + Math.floor(world.stuntStats.takedowns / 2 + world.raceTime / 28),
        1,
        5
      );
      if (world.heatLevel >= 2 && !player.isAirborne && (player.spikeStripTimer ?? 0) <= 0) {
        const spikeS = world.track.totalLength * 0.38;
        if (Math.abs(signedTrackDelta(player.s, spikeS, world.track.totalLength)) < 3.0 && Math.abs(player.d) < 4.5) {
          player.spikeStripTimer = 5.0;
          player.speed *= 0.72;
          world.combatBanner = 'SPIKE STRIP HIT! FIND ENERGY PAD!';
          world.combatBannerTimer = 2.0;
        }
      }
      if (world.heatLevel >= 4) {
        if (world.heliLockTimer === null) {
          world.heliLockTimer = 3.0;
        } else if (player.isNitroActive || player.isShockwave) {
          world.heliLockTimer = null;
        } else {
          world.heliLockTimer = Math.max(0, world.heliLockTimer - effectiveDt);
          if (world.heliLockTimer <= 0) {
            player.empStallTimer = 2.0;
            player.speed *= 0.55;
            world.heliLockTimer = null;
            events.empBlastTriggered = true;
            world.combatBanner = 'HELI EMP LOCK-ON HIT!';
            world.combatBannerTimer = 2.0;
          }
        }
      }
    }
  }

  if (world.phase === 'racing' && player.finished) {
    world.phase = 'slowmo_finish';
    world.slowmoTimer = SLOWMO_DURATION;
  } else if (world.phase === 'slowmo_finish') {
    world.slowmoTimer -= dt;
    if (world.slowmoTimer <= 0) {
      world.phase = 'finished';
      events.playerFinished = true;
    }
  }

  return events;
}

export function getPlayerRacer(world: RaceWorld): RacerState {
  return world.racers.find((r) => r.isPlayer)!;
}

export function getPlayer2Racer(world: RaceWorld): RacerState | null {
  return world.racers.find((r) => r.isPlayer2) ?? null;
}

export function buildHudTelemetry(
  world: RaceWorld,
  cameraMode: HudTelemetry['cameraMode'],
  ghostBestLap: number | null = null
): HudTelemetry {
  const player = getPlayerRacer(world);
  const speedKmh = Math.max(0, Math.round(player.speed * 3.6));
  const maxKmh = player.perf.maxSpeedKmh * 1.38;
  const speedFrac = clamp(speedKmh / maxKmh, 0, 1);

  const gear = clamp(Math.floor(speedFrac * 6.5) + 1, 1, 6);
  const gearBand = 1 / 6;
  const inGear = (speedFrac - (gear - 1) * gearBand) / gearBand;
  const rpmRatio =
    world.phase === 'countdown'
      ? 0.24 + Math.sin(world.countdownTimer * 12) * 0.05
      : clamp(0.22 + inGear * 0.74 + (player.isNitroActive ? 0.14 : 0), 0.16, 1);

  const p2 = getPlayer2Racer(world);
  let p2Telemetry: SplitPlayerTelemetry | null = null;
  if (p2) {
    const p2Speed = Math.max(0, Math.round(p2.speed * 3.6));
    const p2Gear = clamp(Math.floor(clamp(p2Speed / maxKmh, 0, 1) * 6.5) + 1, 1, 6);
    p2Telemetry = {
      speedKmh: p2Speed,
      gear: p2Gear,
      nitro: Math.round(p2.nitro),
      shockwaveReady: !p2.isShockwave && p2.nitro >= p2.perf.shockwaveThreshold,
      isNitro: p2.isNitroActive,
      isShockwave: p2.isShockwave,
      place: p2.place,
      lap: Math.min(p2.lap, world.totalLaps),
    };
  }

  const minimapRacers = world.racers.map((r) => {
    const m = world.track.minimap;
    return {
      id: r.id,
      x: (r.worldPos.x - m.minX) * m.scale + m.offsetX,
      y: (r.worldPos.z - m.minZ) * m.scale + m.offsetZ,
      color: r.isPlayer ? '#f59e0b' : r.isPlayer2 ? '#e11d48' : r.bodyColor,
      isPlayer: r.isPlayer,
    };
  });

  return {
    mode: world.mode,
    phase: world.phase,
    countdownValue:
      world.phase === 'countdown' ? Math.min(3, Math.max(1, Math.ceil(world.countdownTimer))) : 0,
    speedKmh,
    rpmRatio,
    gear,
    nitro: Math.round(player.nitro),
    shockwaveReady: !player.isShockwave && player.nitro >= player.perf.shockwaveThreshold,
    isNitro: player.isNitroActive,
    isShockwave: player.isShockwave,
    isDrifting: player.isDrifting,
    isAirborne: player.isAirborne,
    boostActive: player.boostTimer > 0,
    shieldActive: player.shieldTimer > 0,
    shieldRemaining: Math.ceil(player.shieldTimer),
    place: player.place,
    totalRacers: world.racers.length,
    lap: Math.min(player.lap, world.totalLaps),
    totalLaps: world.totalLaps,
    raceTime: world.raceTime,
    currentLapTime: player.currentLapTime,
    bestLapTime: player.bestLapTime,
    cameraMode,
    wrongWay: Math.abs(player.headingOffset) > 1.2,
    stuntCash: world.stuntStats.totalStuntCash,
    stuntMultiplier: world.stuntStats.stuntMultiplier,
    takedowns: world.stuntStats.takedowns,
    integrity: Math.round(player.integrity),
    maxIntegrity: player.maxIntegrity,
    isBrokenDown: player.isBrokenDown,
    breakdownProgress: player.isBrokenDown ? Math.round(player.nitro) : 100,
    shuntReady: player.shuntCooldown <= 0 && !player.isBrokenDown,
    eliminationTimer: world.eliminationTimer,
    rampageTimer: world.rampageTimer,
    isBossFight: world.isBossFight,
    bossName: world.bossName,
    weatherTime: world.weatherTime,
    combatBanner: world.combatBanner,
    heatLevel: world.heatLevel,
    heliLockTimer: world.heliLockTimer,
    spikeStripActive: (player.spikeStripTimer ?? 0) > 0,
    hasGhost: ghostBestLap !== null,
    ghostBestLap,
    p2Telemetry,
    minimapRacers,
  };
}

export function finalizeRaceResults(
  world: RaceWorld,
  profile: PlayerProfile
): { summary: RaceResultSummary; updatedProfile: PlayerProfile } {
  const totalRaceDist = world.track.totalLength * world.totalLaps;

  const estimatedEntries: RaceFinishEntry[] = world.racers
    .map((r) => {
      let finishTime = r.finishTime;
      if (finishTime === null) {
        const remaining = Math.max(8, totalRaceDist - r.totalDistance);
        const cruiseSpeed = Math.max(32, r.speed, r.perf.maxSpeedMps * 0.86);
        finishTime = world.raceTime + remaining / cruiseSpeed;
      }
      const bestLap = r.bestLapTime ?? finishTime / world.totalLaps;
      return {
        racerId: r.id,
        name: r.name,
        isPlayer: r.isPlayer,
        carId: r.carId,
        bodyColor: r.bodyColor,
        styleLabel: r.styleLabel,
        place: 1,
        finishTime,
        bestLapTime: bestLap,
        pointsAwarded: 0,
      };
    })
    .sort((a, b) => a.finishTime - b.finishTime)
    .map((entry, idx) => ({
      ...entry,
      place: idx + 1,
      pointsAwarded: getPointsForPlace(idx + 1),
    }));

  const playerEntry = estimatedEntries.find((e) => e.isPlayer)!;
  const fastestLapEntry = estimatedEntries.reduce((best, curr) => {
    const bTime = best.bestLapTime ?? Infinity;
    const cTime = curr.bestLapTime ?? Infinity;
    return cTime < bTime ? curr : best;
  }, estimatedEntries[0]);

  const wonFastestLapBonus = fastestLapEntry.isPlayer;
  const diffMult = world.mode === 'tournament' ? world.aiDifficulty : 1.0;
  const positionCash = getCashForPlace(playerEntry.place, diffMult);
  const fastestLapCash = wonFastestLapBonus ? FASTEST_LAP_BONUS_CASH : 0;

  recomputeStuntSummary(world.stuntStats);
  const stuntStats: RaceStuntStats = { ...world.stuntStats };

  const playerDriver = DRIVER_CATALOG[profile.selectedDriverId] ?? DRIVER_CATALOG.rookie;
  const driverCashBonus = Math.round(
    (positionCash + fastestLapCash) * Math.max(0, playerDriver.perks.baseCashMult - 1)
  );

  let tournamentBonusCash = 0;
  let unlockedTournamentId: TournamentId | null = null;
  let wonTournamentTrophy: TournamentId | null = null;
  let updatedStandings: TournamentStanding[] | null = null;
  let isTournamentComplete = false;
  let madeTournamentPodium = false;

  let nextActiveTournament: ActiveTournamentState | null = profile.activeTournament;
  const nextUnlockedTournaments = [...profile.unlockedTournaments];
  const nextTrophies = [...profile.trophies];

  if (world.mode === 'tournament' && world.tournamentId && profile.activeTournament) {
    const tSpec = TOURNAMENT_CATALOG[world.tournamentId];
    const currentStandings = profile.activeTournament.standings.map((row) => {
      const match = estimatedEntries.find((e) => e.racerId === row.racerId);
      if (!match) return row;
      return {
        ...row,
        points: row.points + match.pointsAwarded,
        wins: row.wins + (match.place === 1 ? 1 : 0),
      };
    });

    updatedStandings = sortStandings(currentStandings);
    const raceIndex = profile.activeTournament.currentRaceIndex;
    const finalRace = raceIndex >= tSpec.tracks.length - 1;

    if (finalRace) {
      isTournamentComplete = true;
      const playerStandingRank = updatedStandings.findIndex((s) => s.isPlayer) + 1;

      if (playerStandingRank >= 1 && playerStandingRank <= 3) {
        madeTournamentPodium = true;
        const podiumShare = playerStandingRank === 1 ? 1.0 : playerStandingRank === 2 ? 0.6 : 0.35;
        tournamentBonusCash = Math.round(tSpec.prizeCash * podiumShare);

        if (playerStandingRank === 1) {
          wonTournamentTrophy = world.tournamentId;
          if (!nextTrophies.includes(world.tournamentId)) {
            nextTrophies.push(world.tournamentId);
          }
        }

        const nextTier = getNextTournamentId(world.tournamentId);
        if (nextTier && !nextUnlockedTournaments.includes(nextTier)) {
          nextUnlockedTournaments.push(nextTier);
          unlockedTournamentId = nextTier;
        }
      }

      nextActiveTournament = {
        ...profile.activeTournament,
        standings: updatedStandings,
        completed: true,
      };
    } else {
      nextActiveTournament = {
        ...profile.activeTournament,
        currentRaceIndex: raceIndex + 1,
        standings: updatedStandings,
        completed: false,
      };
    }
  }

  const totalCashEarned =
    positionCash + fastestLapCash + stuntStats.totalStuntCash + driverCashBonus + tournamentBonusCash;

  const nextUnlockedCars = [...profile.unlockedCars];
  if (
    world.isBossFight &&
    playerEntry.place === 1 &&
    world.bossRewardCarId &&
    !nextUnlockedCars.includes(world.bossRewardCarId)
  ) {
    nextUnlockedCars.push(world.bossRewardCarId);
  }

  const updatedProfile: PlayerProfile = {
    ...profile,
    cash: profile.cash + totalCashEarned,
    unlockedCars: nextUnlockedCars,
    unlockedTournaments: nextUnlockedTournaments,
    trophies: nextTrophies,
    activeTournament: nextActiveTournament,
  };

  const summary: RaceResultSummary = {
    trackId: world.track.id,
    mode: world.mode,
    tournamentId: world.tournamentId,
    raceIndex: world.raceIndex,
    entries: estimatedEntries,
    playerPlace: playerEntry.place,
    playerBestLap: playerEntry.bestLapTime,
    fastestLapRacerId: fastestLapEntry.racerId,
    wonFastestLapBonus,
    positionCash,
    fastestLapCash,
    stuntStats,
    driverCashBonus,
    tournamentBonusCash,
    totalCashEarned,
    unlockedTournamentId,
    wonTournamentTrophy,
    updatedStandings,
    isTournamentComplete,
    madeTournamentPodium,
  };

  return { summary, updatedProfile };
}
