import assert from 'node:assert/strict';
import test from 'node:test';
import { computeDynamicMusicParams, ENGINE_PROFILES } from './audio';
import {
  CAR_CATALOG,
  CAR_ORDER,
  CAR_TOOL_ORDER,
  checkCarMeetsTournamentGate,
  computeCarPerformance,
  createInitialStandings,
  DRIVER_CATALOG,
  DRIVER_ORDER,
  TOURNAMENT_CATALOG,
  TOURNAMENT_ORDER,
  TRACK_ORDER,
} from './catalog';
import { mapGamepadAxesAndButtons } from './gamepad';
import { generateDailyChallenge } from './dailyChallenge';
import {
  decodeGhostChallengeCode,
  encodeGhostChallengeCode,
  GhostLapRecorder,
  sampleGhostFrameAtTime,
} from './ghost';
import { minifySdp } from './hotspotP2P';
import { ActionReplayRecorder } from './replay';
import { decodeSignalPayload, encodeSignalPayload, generateQrMatrix } from './p2p';
import {
  buildHudTelemetry,
  computeDynamicRubberBand,
  createRaceWorld,
  finalizeRaceResults,
  getPlayer2Racer,
  getPlayerRacer,
  stepRaceWorld,
} from './physics';
import {
  buyOrToggleCarToolInProfile,
  createDefaultProfile,
  migrateProfileData,
  recruitOrSelectDriverInProfile,
  unlockOrEquipCarInProfile,
  upgradeCarStatInProfile,
} from './storage';
import { getTrackData } from './tracks';
import type { InputState } from './types';

const IDLE_INPUT: InputState = {
  throttle: false,
  brake: false,
  left: false,
  right: false,
  drift: false,
  nitro: false,
};

test('All 4 tracks build valid closed-loop splines with ramps, pickups, smashables, and minimap bounds', () => {
  assert.equal(TRACK_ORDER.length, 4);
  for (const tid of TRACK_ORDER) {
    const track = getTrackData(tid);
    assert.ok(track.totalLength > 800, `Track ${tid} length should exceed 800m`);
    assert.equal(track.boostPads.length, 6);
    assert.equal(track.ramps.length, 4);
    assert.equal(track.pickupTemplates.length, 16);
    assert.equal(track.smashableTemplates.length, 18);

    const first = track.samples[0];
    const last = track.samples[track.samples.length - 1];
    const seamDist = Math.hypot(
      first.pos.x - last.pos.x,
      first.pos.y - last.pos.y,
      first.pos.z - last.pos.z
    );
    assert.ok(seamDist < 12, `Track ${tid} loop seam gap too large: ${seamDist}`);

    for (const pt of track.minimap.points) {
      assert.ok(pt.x >= 0 && pt.x <= 1 && pt.y >= 0 && pt.y <= 1);
    }
  }
});

test('Garage catalog has 18 cars across D/C/B/S/HYPER, 5 Car Tools, and Dual Nitrous lowers Shockwave threshold to 75%', () => {
  assert.equal(CAR_ORDER.length, 18);
  assert.equal(CAR_TOOL_ORDER.length, 5);
  assert.equal(DRIVER_ORDER.length, 6);
  assert.equal(TOURNAMENT_ORDER.length, 8);

  const classesSeen = new Set(CAR_ORDER.map((id) => CAR_CATALOG[id].carClass));
  for (const expectedClass of ['D', 'C', 'B', 'S', 'HYPER'] as const) {
    assert.ok(classesSeen.has(expectedClass), `Missing car class ${expectedClass}`);
  }
  for (const cid of CAR_ORDER) {
    const car = CAR_CATALOG[cid];
    assert.ok(car.brandOrigin.length > 0);
    assert.ok(car.engineLabel.length > 0);
    assert.ok(car.engineType in ENGINE_PROFILES, `Missing acoustic profile for ${car.engineType}`);
  }

  const profile = createDefaultProfile();
  const basePerf = computeCarPerformance('civic_gt', profile.upgrades.civic_gt, []);
  assert.equal(basePerf.shockwaveThreshold, 100);
  assert.equal(basePerf.hasActiveAero, false);

  const tunedPerf = computeCarPerformance('civic_gt', profile.upgrades.civic_gt, [
    'turbo',
    'aero',
    'nitrous',
  ]);
  assert.equal(tunedPerf.shockwaveThreshold, 75);
  assert.equal(tunedPerf.hasActiveAero, true);
  assert.ok(tunedPerf.powerRating > basePerf.powerRating + 300);
  assert.ok(tunedPerf.accelMps2 > basePerf.accelMps2);

  const chironPerf = computeCarPerformance('molsheim_chiron', profile.upgrades.molsheim_chiron, []);
  assert.ok(chironPerf.maxSpeedKmh > 345, 'Hypercar Chiron should have 345+ km/h base top speed');
});

test('Purchasing Car Tools, upgrading stats, unlocking cars, and recruiting Pro Drivers deduct cash and persist properly', () => {
  let profile = createDefaultProfile();
  profile.cash = 10000;

  // Buy & auto-equip Active Aero tool
  profile = buyOrToggleCarToolInProfile(profile, 'civic_gt', 'aero');
  assert.ok(profile.ownedTools.civic_gt.includes('aero'));
  assert.ok(profile.equippedTools.civic_gt.includes('aero'));

  // Toggle Active Aero off without charging again
  const cashAfterBuy = profile.cash;
  profile = buyOrToggleCarToolInProfile(profile, 'civic_gt', 'aero');
  assert.equal(profile.cash, cashAfterBuy);
  assert.ok(!profile.equippedTools.civic_gt.includes('aero'));

  // Upgrade top speed
  profile = upgradeCarStatInProfile(profile, 'civic_gt', 'topSpeed');
  assert.equal(profile.upgrades.civic_gt.topSpeed, 2);

  // Recruit Kenji Sato
  profile = recruitOrSelectDriverInProfile(profile, 'kenji');
  assert.equal(profile.selectedDriverId, 'kenji');
  assert.ok(profile.unlockedDrivers.includes('kenji'));

  // Unlock Class C muscle car
  profile = unlockOrEquipCarInProfile(profile, 'muscle_v8');
  assert.equal(profile.selectedCarId, 'muscle_v8');
  assert.ok(profile.unlockedCars.includes('muscle_v8'));
  assert.ok(profile.cash < cashAfterBuy);
});

test('Career Class & PR gating blocks under-spec cars and accepts eligible cars', () => {
  const starterGate = checkCarMeetsTournamentGate('civic_gt', 1120, 'rookie_street');
  assert.equal(starterGate.eligible, true);

  const highCupBlocked = checkCarMeetsTournamentGate('civic_gt', 1120, 'world_masters');
  assert.equal(highCupBlocked.eligible, false);
  assert.ok(highCupBlocked.reason && highCupBlocked.reason.includes('Class S'));

  const hyperLowPr = checkCarMeetsTournamentGate('scuderia_sf90', 3200, 'world_masters');
  assert.equal(hyperLowPr.eligible, false);

  const hyperReady = checkCarMeetsTournamentGate('molsheim_chiron', 4460, 'world_masters');
  assert.equal(hyperReady.eligible, true);
});

test('Physics simulation: countdown transitions to racing, drifting charges Nitro, Shockwave activates, and ramps launch airborne', () => {
  const profile = createDefaultProfile();
  profile.selectedDriverId = 'jax'; // +30% ramp launch & 2x Air-Time cash
  profile.unlockedDrivers.push('jax');
  profile.ownedTools.civic_gt.push('nitrous');
  profile.equippedTools.civic_gt.push('nitrous');

  const world = createRaceWorld({ mode: 'quick', trackId: 'alpine', profile });
  assert.equal(world.phase, 'countdown');

  // Step through 3s countdown
  for (let i = 0; i < 65; i++) {
    stepRaceWorld(world, IDLE_INPUT, 0.05);
  }
  assert.equal(world.phase, 'racing');

  const player = getPlayerRacer(world);
  const startNitro = player.nitro;

  // Accelerate and drift right
  for (let i = 0; i < 45; i++) {
    stepRaceWorld(
      world,
      { throttle: true, brake: false, left: false, right: true, drift: i > 15, nitro: false },
      0.05
    );
  }
  assert.ok(player.speed > 25, 'Player car should accelerate smoothly');
  assert.ok(player.nitro > startNitro, 'Drifting should charge Nitro');

  // Trigger Purple Shockwave (Dual-Stage Nitrous triggers at 75%+)
  player.nitro = 82;
  const swEvents = stepRaceWorld(
    world,
    { throttle: true, brake: false, left: false, right: false, drift: false, nitro: true },
    0.05
  );
  assert.equal(player.isShockwave, true);
  assert.equal(swEvents.playerShockwaveStarted, true);

  // Position player onto Ramp #0 crest to verify launch & Air-Time cash
  const ramp0 = world.track.ramps[0];
  player.s = ramp0.s + ramp0.length * 0.35;
  player.d = ramp0.d;
  player.speed = 55;
  player.rampCooldown = 0;
  player.isAirborne = false;
  player.yOffset = 0;

  const launchEv = stepRaceWorld(
    world,
    { throttle: true, brake: false, left: false, right: false, drift: false, nitro: false },
    0.05
  );
  assert.equal(launchEv.playerRampLaunched, true);
  assert.equal(player.isAirborne, true);
  assert.ok(player.vy > 15);

  // Step until landing
  for (let i = 0; i < 45; i++) {
    stepRaceWorld(
      world,
      { throttle: true, brake: false, left: false, right: false, drift: false, nitro: false },
      0.05
    );
  }
  assert.equal(player.isAirborne, false);
  assert.ok(world.stuntStats.airTimeCash > 0, 'Landing a jump should award Air-Time stunt cash');
});

test('On-track pickups, smashable barriers, and Rival Takedowns award cash and spin out AI', () => {
  const profile = createDefaultProfile();
  profile.selectedDriverId = 'marcus'; // +50% takedown cash
  profile.unlockedDrivers.push('marcus');
  const world = createRaceWorld({ mode: 'quick', trackId: 'night', profile });
  world.phase = 'racing';

  const player = getPlayerRacer(world);
  const coin = world.pickups.find((p) => p.kind === 'coin')!;
  player.s = coin.s;
  player.d = coin.d;
  player.yOffset = Math.max(0, coin.yOffset - 1.0);
  player.speed = 40;

  const pickEv = stepRaceWorld(world, { ...IDLE_INPUT, throttle: true }, 0.05);
  assert.equal(pickEv.playerPickupKind, 'coin');
  assert.equal(coin.collected, true);
  assert.ok(world.stuntStats.pickupCash >= 150);

  // Rival Takedown while boosting
  const rival = world.racers.find((r) => !r.isPlayer)!;
  player.s = rival.s;
  player.d = rival.d + 1.0;
  player.yOffset = 0;
  rival.yOffset = 0;
  player.nitro = 100;
  player.speed = 65;
  rival.speed = 50;

  const tdEv = stepRaceWorld(
    world,
    { ...IDLE_INPUT, throttle: true, nitro: true },
    0.05
  );
  assert.equal(tdEv.playerTakedown, true);
  assert.ok(rival.spinoutTimer > 0.5, 'Takedown should spin out AI rival');
  assert.equal(world.stuntStats.takedowns, 1);
  // Marcus perk: $300 * 1.5 = $450
  assert.equal(world.stuntStats.takedownCash, 450);

  const hud = buildHudTelemetry(world, 'chase');
  assert.equal(hud.takedowns, 1);
  assert.ok(hud.stuntMultiplier > 1.0);
});

test('Tournament podium (top 3 overall) unlocks next championship tier and awards trophy on 1st', () => {
  const profile = createDefaultProfile();
  const standings = createInitialStandings(
    profile.playerName,
    profile.selectedCarId,
    CAR_CATALOG[profile.selectedCarId].defaultCustomization.bodyColor
  );
  standings[0].points = 20;
  standings[0].wins = 2;
  profile.activeTournament = {
    tournamentId: 'rookie_street',
    currentRaceIndex: 2,
    standings,
    completed: false,
  };

  const world = createRaceWorld({
    mode: 'tournament',
    trackId: TOURNAMENT_CATALOG.rookie_street.tracks[2],
    tournamentId: 'rookie_street',
    raceIndex: 2,
    profile,
  });
  world.phase = 'finished';
  world.raceTime = 78.4;

  const player = getPlayerRacer(world);
  player.finished = true;
  player.finishTime = 76.2;
  player.bestLapTime = 24.5;
  player.totalDistance = world.track.totalLength * world.totalLaps;

  const { summary, updatedProfile } = finalizeRaceResults(world, profile);
  assert.equal(summary.isTournamentComplete, true);
  assert.equal(summary.madeTournamentPodium, true);
  assert.equal(summary.wonTournamentTrophy, 'rookie_street');
  assert.equal(summary.unlockedTournamentId, 'coastal_drift');
  assert.ok(updatedProfile.unlockedTournaments.includes('coastal_drift'));
  assert.ok(updatedProfile.trophies.includes('rookie_street'));
  assert.ok(summary.driverCashBonus > 0, 'Rookie Racer should receive +5% base cash bonus');
  assert.ok(updatedProfile.cash > profile.cash);
});

test('Bluetooth Gamepad mapper applies deadzone, analog steering, progressive triggers, and face buttons', () => {
  const mkBtns = (overrides: Record<number, { pressed: boolean; value: number }> = {}) =>
    Array.from({ length: 16 }, (_, i) => overrides[i] ?? { pressed: false, value: 0 });

  // Inside deadzone -> zero steering
  const dead = mapGamepadAxesAndButtons([0.08], mkBtns());
  assert.equal(dead.input.analogSteer, 0);
  assert.equal(dead.input.left, false);
  assert.equal(dead.input.right, false);

  // Analog right steer + progressive RT throttle + B drift + Y nitro + Start pause
  const active = mapGamepadAxesAndButtons(
    [0.57],
    mkBtns({
      7: { pressed: true, value: 0.72 },
      1: { pressed: true, value: 1 },
      3: { pressed: true, value: 1 },
      9: { pressed: true, value: 1 },
    })
  );
  assert.ok((active.input.analogSteer ?? 0) > 0.45 && (active.input.analogSteer ?? 0) < 0.55);
  assert.equal(active.input.right, true);
  assert.equal(active.input.throttle, true);
  assert.equal(active.input.analogThrottle, 0.72);
  assert.equal(active.input.drift, true);
  assert.equal(active.input.nitro, true);
  assert.equal(active.pauseDown, true);
});

test('Serverless WebRTC P2P Base64 session codec round-trips and procedural QR matrix builds valid finder squares', () => {
  const code = encodeSignalPayload({
    v: 1,
    t: 'offer',
    sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\na=extmap:1 ignore\r\na=candidate:1 1 udp 123 192.168.1.5 54321 typ host\r\n',
    name: 'Host Racer',
    carId: 'molsheim_chiron',
    color: '#06b6d4',
    trackId: 'night',
  });
  assert.ok(code.startsWith('MA1:'));

  const decoded = decodeSignalPayload(code);
  assert.ok(decoded !== null);
  assert.equal(decoded!.name, 'Host Racer');
  assert.equal(decoded!.carId, 'molsheim_chiron');
  assert.equal(decoded!.trackId, 'night');
  assert.ok(decoded!.sdp.includes('a=candidate:'));
  assert.ok(!decoded!.sdp.includes('a=extmap'));

  assert.equal(decodeSignalPayload('INVALID_CODE'), null);

  const qr = generateQrMatrix(code, 33);
  assert.equal(qr.length, 33);
  assert.equal(qr[0][0], true);
  assert.equal(qr[1][1], false);
  assert.equal(qr[3][3], true);
  assert.equal(qr[0][32], true);
  assert.equal(qr[32][0], true);
});

test('Ghost Lap Recorder & interpolator smoothly wrap across track start/finish seam', () => {
  const profile = createDefaultProfile();
  const world = createRaceWorld({ mode: 'quick', trackId: 'night', profile });
  world.phase = 'racing';
  const player = getPlayerRacer(world);
  const recorder = new GhostLapRecorder();

  for (let i = 0; i < 60; i++) {
    player.currentLapTime = i * 0.12;
    player.s = (i * 15) % world.track.totalLength;
    player.d = Math.sin(i * 0.2) * 3;
    recorder.recordStep(player);
  }
  const record = recorder.finishLap('night', player.carId, player.bodyColor, 7.2);
  assert.ok(record !== null);
  assert.ok(record!.frames.length >= 40);

  const mid = sampleGhostFrameAtTime(record!, 1.26, world.track.totalLength);
  assert.ok(mid !== null);
  assert.ok(mid!.s > 100 && mid!.s < 200);
});

test('Split-Screen P2 controls, articulated brake rotor heat, nose-dive pitch, and P2P remote interpolation work deterministically', () => {
  const profile = createDefaultProfile();
  const splitWorld = createRaceWorld({ mode: 'splitscreen', trackId: 'night', profile });
  splitWorld.phase = 'racing';
  const p1 = getPlayerRacer(splitWorld);
  const p2 = getPlayer2Racer(splitWorld);
  assert.ok(p2 !== null, 'Split-Screen world should spawn Player 2 racer');

  // Accelerate both players
  for (let i = 0; i < 30; i++) {
    stepRaceWorld(
      splitWorld,
      { ...IDLE_INPUT, throttle: true },
      0.05,
      { ...IDLE_INPUT, throttle: true, right: true }
    );
  }
  assert.ok(p1.speed > 20);
  assert.ok(p2!.speed > 20);
  assert.ok(p2!.steerAngle > 0.2, 'Player 2 front wheels should visibly steer right');

  // Heavy braking on P1 -> glowing brake rotor heat & positive nose-dive pitch
  for (let i = 0; i < 12; i++) {
    stepRaceWorld(splitWorld, { ...IDLE_INPUT, brake: true }, 0.05, IDLE_INPUT);
  }
  assert.ok(p1.brakeHeat > 0.4, 'Heavy braking should heat brake rotors for emissive glow');
  assert.ok(p1.bodyPitch > 0.02, 'Heavy braking should induce suspension nose-dive pitch');

  const hud = buildHudTelemetry(splitWorld, 'chase');
  assert.ok(hud.p2Telemetry !== null);
  assert.equal(hud.mode, 'splitscreen');

  // P2P remote peer smooth interpolation
  const p2pWorld = createRaceWorld({
    mode: 'p2p',
    trackId: 'night',
    profile,
    remotePeer: { name: 'Hotspot Rival', carId: 'stuttgart_gt3rs', bodyColor: '#22d3ee' },
  });
  p2pWorld.phase = 'racing';
  const remoteRacer = p2pWorld.racers.find((r) => r.isRemotePeer)!;
  stepRaceWorld(p2pWorld, { ...IDLE_INPUT, throttle: true }, 0.05, undefined, {
    type: 'state',
    s: 140,
    d: 2.5,
    y: 0.4,
    yaw: 0.25,
    speed: 62,
    steer: -0.3,
    roll: 0.08,
    pitch: -0.05,
    drift: true,
    nitro: true,
    shockwave: true,
    shield: false,
    spinout: 0,
    lap: 1,
    totalDistance: 140,
    finished: false,
    ts: 1000,
  });
  assert.equal(remoteRacer.isShockwave, true);
  assert.equal(remoteRacer.isDrifting, true);
  assert.ok(remoteRacer.totalDistance === 140);
});

test('Legacy localStorage profile safely migrates retired car IDs and preserves cash, trophies, and upgrades', () => {
  const legacyRaw = {
    playerName: 'Veteran Ace',
    cash: 48200,
    selectedCarId: 'cyber_hyper',
    unlockedCars: ['civic_gt', 'gt_track', 'cyber_hyper', 'apex_zenith'],
    unlockedDrivers: ['rookie', 'sofia'],
    trophies: ['rookie_street', 'coastal_drift'],
    upgrades: {
      cyber_hyper: { topSpeed: 4, acceleration: 3, handling: 4, nitro: 5 },
    },
    ownedTools: {
      gt_track: ['aero', 'turbo'],
    },
    equippedTools: {
      gt_track: ['aero'],
    },
  };

  const migrated = migrateProfileData(legacyRaw);
  assert.equal(migrated.cash, 48200);
  assert.equal(migrated.selectedCarId, 'scuderia_sf90');
  assert.ok(migrated.unlockedCars.includes('stuttgart_gt3rs'));
  assert.ok(migrated.unlockedCars.includes('scuderia_sf90'));
  assert.ok(migrated.unlockedCars.includes('veloce_larossa'));
  assert.equal(migrated.upgrades.scuderia_sf90.topSpeed, 4);
  assert.equal(migrated.upgrades.scuderia_sf90.nitro, 5);
  assert.ok(migrated.ownedTools.stuttgart_gt3rs.includes('aero'));
  assert.ok(migrated.upgrades.molsheim_chiron !== undefined, 'New cars receive default upgrades');
  assert.equal(migrated.trophies.length, 2);
});

test('Dynamic rubber-banding responds to longitudinal gap, player standing, and race progress within safe bounds', () => {
  // AI far ahead while player is 5th -> AI slows down smoothly
  const aheadSlow = computeDynamicRubberBand({
    gapMeters: 120,
    playerPlace: 5,
    raceProgress: 0.85,
    aiAggression: 0.9,
    aiSkill: 1.0,
  });
  assert.ok(aheadSlow.speedMult < 0.92, `Expected AI ahead to ease, got ${aheadSlow.speedMult}`);
  assert.ok(aheadSlow.speedMult >= 0.84, 'Speed multiplier should respect lower bound');

  // AI trailing while player leads in 1st late in race -> AI pushes harder & raises Nitro urgency
  const behindChase = computeDynamicRubberBand({
    gapMeters: -110,
    playerPlace: 1,
    raceProgress: 0.9,
    aiAggression: 1.15,
    aiSkill: 1.02,
  });
  assert.ok(behindChase.speedMult > 1.1, `Expected trailing AI catch-up boost, got ${behindChase.speedMult}`);
  assert.ok(behindChase.speedMult <= 1.18, 'Speed multiplier should respect upper bound');
  assert.ok(behindChase.accelMult > 1.12);
  assert.ok(behindChase.nitroUrgency > 0.75, 'Trailing AI late in race should fire Nitro aggressively');

  // Final lap intensifies competition compared to Lap 1 at identical gap
  const earlyLap = computeDynamicRubberBand({
    gapMeters: -70,
    playerPlace: 1,
    raceProgress: 0.1,
    aiAggression: 1.0,
    aiSkill: 1.0,
  });
  const finalLap = computeDynamicRubberBand({
    gapMeters: -70,
    playerPlace: 1,
    raceProgress: 0.95,
    aiAggression: 1.0,
    aiSkill: 1.0,
  });
  assert.ok(finalLap.speedMult > earlyLap.speedMult);
  assert.ok(finalLap.nitroUrgency > earlyLap.nitroUrgency);
});

test('Dynamic adaptive soundtrack scales tempo and synth layers across idle, high-RPM, Nitro, and Shockwave', () => {
  const idle = computeDynamicMusicParams(0.2, 0, false, false);
  const fast = computeDynamicMusicParams(0.88, 280, false, false);
  const nitro = computeDynamicMusicParams(0.95, 340, true, false);
  const shockwave = computeDynamicMusicParams(1.0, 420, true, true);

  assert.ok(fast.bpm > idle.bpm, 'High speed/RPM should raise BPM');
  assert.ok(nitro.bpm > fast.bpm, 'Nitro should boost BPM further');
  assert.ok(shockwave.bpm > nitro.bpm, 'Shockwave should hit peak BPM');
  assert.ok(shockwave.stepMs < idle.stepMs, 'Higher BPM should shorten 16th-note step interval');

  assert.ok(fast.leadLayer > idle.leadLayer, 'Lead arpeggio should intensify at high RPM');
  assert.ok(fast.percussionLayer > idle.percussionLayer, 'Percussion should intensify with speed');
  assert.equal(idle.nitroShimmerLayer, 0);
  assert.ok(nitro.nitroShimmerLayer >= 0.6);
  assert.equal(shockwave.nitroShimmerLayer, 1.0);
});

test('Elimination mode eliminates last-place racer at 0.0s and resets 20s timer', () => {
  const profile = createDefaultProfile();
  const world = createRaceWorld({ mode: 'elimination', trackId: 'coastal', profile });
  assert.equal(world.eliminationTimer, 20.0);
  world.phase = 'racing';
  world.eliminationTimer = 0.02;

  const ev = stepRaceWorld(world, { ...IDLE_INPUT, throttle: true }, 0.05);
  assert.equal(ev.eliminationBoom, true);
  const eliminatedCount = world.racers.filter((r) => r.eliminated).length;
  assert.equal(eliminatedCount, 1);
  assert.equal(world.eliminationTimer, 20.0);
});

test('Rampage mode initializes 90s timer and awards +8s on rival wreck takedown', () => {
  const profile = createDefaultProfile();
  const world = createRaceWorld({ mode: 'rampage', trackId: 'night', profile });
  assert.equal(world.rampageTimer, 90.0);
  world.phase = 'racing';

  const player = getPlayerRacer(world);
  const rival = world.racers.find((r) => !r.isPlayer)!;
  player.s = 120;
  player.d = 0;
  player.speed = 70;
  player.isShockwave = true;
  rival.s = 120.5;
  rival.d = 0.5;
  rival.speed = 25;
  rival.integrity = 10;

  const ev = stepRaceWorld(world, { ...IDLE_INPUT, throttle: true, nitro: true }, 0.04);
  assert.equal(ev.playerTakedown, true);
  assert.ok((world.rampageTimer ?? 0) > 95, 'Takedown should add +8s bonus time in Rampage');
});

test('1v1 Boss Showdown spawns Cup Boss with 115 maxIntegrity and Ghost Challenge Code round-trips', () => {
  const profile = createDefaultProfile();
  profile.cash = 10000;
  const modProfile = buyOrToggleCarToolInProfile(profile, 'civic_gt', 'turbo');
  const bossWorld = createRaceWorld({
    mode: 'tournament',
    trackId: 'coastal',
    tournamentId: 'rookie_street',
    raceIndex: 2,
    profile: modProfile,
  });
  assert.equal(bossWorld.isBossFight, true);
  assert.equal(bossWorld.racers.length, 2);
  const boss = bossWorld.racers.find((r) => r.isBoss);
  assert.ok(boss && boss.maxIntegrity === 115);

  const code = encodeGhostChallengeCode({
    trackId: 'coastal',
    carId: 'civic_gt',
    bodyColor: '#00e5ff',
    lapTime: 44.32,
    recordedAt: 123456,
    frames: [
      { t: 0, s: 10, d: 0, y: 0, yaw: 0, pitch: 0, roll: 0 },
      { t: 0.1, s: 16, d: 0.2, y: 0, yaw: 0.05, pitch: 0, roll: -0.02 },
    ],
  });
  assert.ok(code.startsWith('MA-GHOST-'));
  const decoded = decodeGhostChallengeCode(code);
  assert.ok(decoded !== null);
  assert.equal(decoded.record.trackId, 'coastal');
  assert.equal(decoded.record.carId, 'civic_gt');
  assert.equal(decoded.record.frames.length, 2);
});

test('Hotspot SDP minifier, Daily Challenge YYYY-MM-DD seeding, Pursuit Heat/Spike Strip, and 30s Replay Ring Buffer', () => {
  const sampleSdp = [
    'v=0',
    'o=- 123 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'a=ice-ufrag:abcd',
    'a=ice-pwd:supersecretpassword',
    'a=extmap-allow-mixed',
    'a=candidate:1 1 UDP 2122260223 192.168.43.1 54321 typ host',
  ].join('\r\n');
  const minified = minifySdp(sampleSdp);
  assert.ok(minified.includes('a=ice-ufrag:abcd'));
  assert.ok(minified.includes('a=candidate:1'));
  assert.ok(!minified.includes('extmap-allow-mixed'));

  const d1 = generateDailyChallenge('2026-11-24');
  const d2 = generateDailyChallenge('2026-11-24');
  assert.deepEqual(d1, d2, 'Daily challenge must be deterministic for same YYYY-MM-DD');

  const pursuitWorld = createRaceWorld({ mode: 'pursuit', trackId: 'night', profile: createDefaultProfile() });
  assert.equal(pursuitWorld.heatLevel, 1);
  assert.ok(pursuitWorld.racers.some((r) => r.isPolice));

  const recorder = new ActionReplayRecorder();
  const player = getPlayerRacer(pursuitWorld);
  for (let i = 0; i < 315; i++) {
    recorder.record(i * 0.1, [player]);
  }
  assert.equal(recorder.getFrames().length, 300, 'Replay ring buffer must cap at 300 frames (30s at 10Hz)');
  const sampled = recorder.sampleAtOffset(5.0);
  assert.ok(sampled !== null);
});




