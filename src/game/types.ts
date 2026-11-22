export type CarClass = 'D' | 'C' | 'B' | 'S' | 'HYPER';

export type EngineType =
  | 'turbo-4'
  | 'muscle-v8'
  | 'wagon-v8'
  | 'v10-howl'
  | 'italian-v12'
  | 'w16-quad-turbo';

export type CarId =
  | 'civic_gt'
  | 'rally_hatch'
  | 'muscle_v8'
  | 'coupe_drift'
  | 'ingolstadt_rs6'
  | 'rally_raid'
  | 'yokohama_gtr'
  | 'marinelli_f40'
  | 'stuttgart_gt3rs'
  | 'vorsprung_r8'
  | 'scuderia_sf90'
  | 'santagata_svj'
  | 'woking_p1'
  | 'veloce_larossa'
  | 'modena_huayra'
  | 'molsheim_chiron'
  | 'angelholm_jesko'
  | 'molsheim_bolide';

export type CarToolId = 'turbo' | 'brakes' | 'aero' | 'nitrous' | 'slicks';

export type DriverId = 'rookie' | 'kenji' | 'elena' | 'marcus' | 'sofia' | 'jax';

export type TrackId = 'coastal' | 'desert' | 'night' | 'alpine';

export type TournamentId =
  | 'rookie_street'
  | 'coastal_drift'
  | 'canyon_velocity'
  | 'neon_metro'
  | 'alpine_apex'
  | 'hypercar_pro'
  | 'world_masters'
  | 'asphalt_legend';

export type GameScreen =
  | 'title'
  | 'garage'
  | 'drivers'
  | 'career'
  | 'multiplayer'
  | 'race'
  | 'podium';

export type RaceMode = 'quick' | 'tournament' | 'p2p' | 'splitscreen';

export type CameraMode = 'chase' | 'hood' | 'far';

export type GraphicsQuality = 'low' | 'high';

export type PaintFinish = 'metallic' | 'matte';

export type UpgradeStatKey = 'topSpeed' | 'acceleration' | 'handling' | 'nitro';

export type AIDrivingStyle =
  | 'apex_drifter'
  | 'sprinter'
  | 'blocker'
  | 'precision'
  | 'nitro_opportunist';

export type PickupKind = 'coin' | 'nitro_blue' | 'nitro_gold' | 'shield';

export type PhotoColorGrade = 'natural' | 'cyberpunk' | 'golden' | 'noir';

export interface PhotoModeSettings {
  active: boolean;
  focalLengthMm: number; // 20..85mm
  rollDeg: number; // -30..30 deg
  motionBlur: number; // 0..1
  colorGrade: PhotoColorGrade;
  hideUi: boolean;
}

export interface GamepadStatus {
  connected: boolean;
  name: string;
  active: boolean;
}

export interface GhostFrame {
  t: number; // elapsed seconds in lap
  s: number;
  d: number;
  y: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export interface TrackGhostRecord {
  trackId: TrackId;
  carId: CarId;
  bodyColor: string;
  lapTime: number;
  recordedAt: number;
  frames: GhostFrame[];
}

export interface P2PNetState {
  type: 'state';
  s: number;
  d: number;
  y: number;
  yaw: number;
  speed: number;
  steer: number;
  roll: number;
  pitch: number;
  drift: boolean;
  nitro: boolean;
  shockwave: boolean;
  shield: boolean;
  spinout: number;
  lap: number;
  totalDistance: number;
  finished: boolean;
  takedownHit?: boolean;
  ts: number;
}

export interface P2PStartPacket {
  type: 'start';
  trackId: TrackId;
  hostName: string;
  hostCarId: CarId;
  hostColor: string;
}

export interface P2PJoinInfoPacket {
  type: 'hello';
  name: string;
  carId: CarId;
  bodyColor: string;
}

export type P2PPacket = P2PNetState | P2PStartPacket | P2PJoinInfoPacket;

export interface UpgradeLevels {
  topSpeed: number; // 1..5
  acceleration: number; // 1..5
  handling: number; // 1..5
  nitro: number; // 1..5
}

export interface CarCustomization {
  bodyColor: string;
  finish: PaintFinish;
  rimColor: string;
  caliperColor: string;
  underglowColor: string; // 'none' or hex string
}

export interface CarBaseStats {
  topSpeed: number; // 1..100 display scale
  acceleration: number;
  handling: number;
  nitro: number;
}

export interface CarSpec {
  id: CarId;
  name: string;
  carClass: CarClass;
  category: string;
  brandOrigin: string;
  engineType: EngineType;
  engineLabel: string;
  secondaryColor?: string;
  silhouette: CarId;
  tagline: string;
  price: number;
  basePowerRating: number;
  baseStats: CarBaseStats;
  defaultCustomization: CarCustomization;
}

export interface CarToolSpec {
  id: CarToolId;
  name: string;
  shortName: string;
  price: number;
  powerRatingBonus: number;
  effectSummary: string;
  statBonuses: Partial<CarBaseStats>;
}

export interface DriverPerkModifiers {
  baseCashMult: number;
  driftNitroMult: number;
  nitroDurationMult: number;
  takedownCashMult: number;
  collisionPowerMult: number;
  gripMult: number;
  offTrackRetention: number;
  rampLaunchMult: number;
  airTimeCashMult: number;
}

export interface DriverSpec {
  id: DriverId;
  name: string;
  nickname: string;
  role: string;
  price: number;
  bio: string;
  perkSummary: string;
  suitPrimary: string;
  suitSecondary: string;
  helmetColor: string;
  visorColor: string;
  perks: DriverPerkModifiers;
}

export interface ComputedCarPerformance {
  powerRating: number;
  maxSpeedKmh: number;
  maxSpeedMps: number;
  accelMps2: number;
  steerRate: number;
  grip: number;
  brakePower: number;
  driftChargeRate: number;
  nitroCapacity: number;
  nitroDrainRate: number;
  nitroBoostMult: number;
  shockwaveBoostMult: number;
  shockwaveThreshold: number;
  hasActiveAero: boolean;
  hasDualNitrous: boolean;
  hasRacingSlicks: boolean;
  displayStats: CarBaseStats;
}

export interface AIRivalProfile {
  id: string;
  name: string;
  style: AIDrivingStyle;
  styleLabel: string;
  carId: CarId;
  bodyColor: string;
  rimColor: string;
  caliperColor: string;
  underglowColor: string;
  baseSkill: number;
}

export interface TrackSpec {
  id: TrackId;
  name: string;
  subtitle: string;
  laps: number;
  roadWidth: number;
  accentHex: string;
  weatherLabel: string;
  description: string;
}

export interface TournamentSpec {
  id: TournamentId;
  order: number;
  name: string;
  allowedClasses: CarClass[];
  classLabel: string;
  minPowerRating: number;
  tracks: [TrackId, TrackId, TrackId];
  aiDifficulty: number;
  aiAggression: number;
  prizeCash: number;
  trophyColor: string;
  description: string;
}

export interface TournamentStanding {
  racerId: string;
  name: string;
  isPlayer: boolean;
  carId: CarId;
  bodyColor: string;
  styleLabel: string;
  points: number;
  wins: number;
}

export interface ActiveTournamentState {
  tournamentId: TournamentId;
  currentRaceIndex: number;
  standings: TournamentStanding[];
  completed: boolean;
}

export interface PlayerProfile {
  playerName: string;
  cash: number;
  selectedCarId: CarId;
  unlockedCars: CarId[];
  selectedDriverId: DriverId;
  unlockedDrivers: DriverId[];
  upgrades: Record<CarId, UpgradeLevels>;
  ownedTools: Record<CarId, CarToolId[]>;
  equippedTools: Record<CarId, CarToolId[]>;
  customizations: Record<CarId, CarCustomization>;
  unlockedTournaments: TournamentId[];
  trophies: TournamentId[];
  activeTournament: ActiveTournamentState | null;
  graphicsQuality: GraphicsQuality;
  volume: number;
  muted: boolean;
  musicEnabled: boolean;
  touchControlsEnabled: boolean;
}

export interface InputState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  nitro: boolean;
  /** Optional smooth analog steering (-1 left .. +1 right) from Bluetooth gamepad */
  analogSteer?: number;
  /** Optional progressive gas trigger (0..1) */
  analogThrottle?: number;
  /** Optional progressive brake trigger (0..1) */
  analogBrake?: number;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface TrackSample {
  s: number;
  t: number;
  pos: Vec3Like;
  tangent: Vec3Like;
  right: Vec3Like;
  curvature: number;
}

export interface BoostPad {
  id: number;
  s: number;
  d: number;
  length: number;
  width: number;
}

export interface TrackRamp {
  id: number;
  s: number;
  d: number;
  length: number;
  width: number;
  height: number;
}

export interface TrackPickup {
  id: number;
  kind: PickupKind;
  s: number;
  d: number;
  yOffset: number;
  collected: boolean;
  respawnTimer: number;
}

export interface SmashableBarrier {
  id: number;
  s: number;
  d: number;
  smashed: boolean;
  respawnTimer: number;
  pos: Vec3Like;
  yaw: number;
}

export interface StuntPopup {
  id: number;
  label: string;
  cash: number;
  color: 'amber' | 'cyan' | 'fuchsia' | 'emerald' | 'rose';
}

export interface RacerState {
  id: string;
  name: string;
  isPlayer: boolean;
  isPlayer2?: boolean;
  isRemotePeer?: boolean;
  carId: CarId;
  bodyColor: string;
  finish: PaintFinish;
  rimColor: string;
  caliperColor: string;
  underglowColor: string;
  hasActiveAero: boolean;
  styleLabel: string;
  aiStyle?: AIDrivingStyle;
  aiSkill: number;
  aiAggression: number;
  perf: ComputedCarPerformance;
  driverPerks: DriverPerkModifiers;

  // Track-relative coordinates
  s: number;
  totalDistance: number;
  d: number;
  headingOffset: number;
  speed: number;
  lateralSpeed: number;

  // Airborne & ramp physics
  yOffset: number;
  vy: number;
  isAirborne: boolean;
  currentAirTime: number;
  rampCooldown: number;

  // Articulated vehicle dynamics & combat states
  steerAngle: number;
  bodyRoll: number;
  bodyPitch: number;
  suspensionHeave: number;
  brakeHeat: number; // 0..1 drives glowing orange-red brake rotors
  driftAngle: number;
  isDrifting: boolean;
  driftDirection: number;
  currentDriftDistance: number;
  isNitroActive: boolean;
  isShockwave: boolean;
  nitro: number;
  boostTimer: number;
  shieldTimer: number;
  spinoutTimer: number;
  spinoutAngle: number;
  wheelSpin: number;

  // Clean lap & near-miss tracking
  lapWallHits: number;
  nearMissCooldowns: Record<string, number>;

  // Race progress
  lap: number;
  maxCheckpoint: number;
  lapStartTime: number;
  currentLapTime: number;
  bestLapTime: number | null;
  finished: boolean;
  finishTime: number | null;
  place: number;

  // AI state
  aiTargetOffset: number;
  aiLaneTimer: number;

  // Cached world transform
  worldPos: Vec3Like;
  worldYaw: number;
}

export interface RaceCollisionEvent {
  type: 'wall' | 'car' | 'takedown' | 'smash';
  intensity: number;
  pos: Vec3Like;
  involvesPlayer: boolean;
}

export interface RaceStepEvents {
  collisions: RaceCollisionEvent[];
  playerBoostTriggered: boolean;
  playerRampLaunched: boolean;
  playerLanded: boolean;
  playerPickupKind: PickupKind | null;
  playerLapCompleted: boolean;
  playerCompletedLapTime: number | null;
  playerFinished: boolean;
  playerNitroStarted: boolean;
  playerShockwaveStarted: boolean;
  playerNitroEnded: boolean;
  playerTakedown: boolean;
  stuntPopups: StuntPopup[];
}

export interface RaceStuntStats {
  driftBonusCash: number;
  takedowns: number;
  takedownCash: number;
  airTimeSeconds: number;
  airTimeCash: number;
  nearMisses: number;
  nearMissCash: number;
  pickupCash: number;
  cleanLaps: number;
  cleanLapCash: number;
  barriersSmashed: number;
  stuntMultiplier: number;
  totalStuntCash: number;
}

export interface RaceFinishEntry {
  racerId: string;
  name: string;
  isPlayer: boolean;
  carId: CarId;
  bodyColor: string;
  styleLabel: string;
  place: number;
  finishTime: number;
  bestLapTime: number | null;
  pointsAwarded: number;
}

export interface RaceResultSummary {
  trackId: TrackId;
  mode: RaceMode;
  tournamentId?: TournamentId;
  raceIndex?: number;
  entries: RaceFinishEntry[];
  playerPlace: number;
  playerBestLap: number | null;
  fastestLapRacerId: string;
  wonFastestLapBonus: boolean;
  positionCash: number;
  fastestLapCash: number;
  stuntStats: RaceStuntStats;
  driverCashBonus: number;
  tournamentBonusCash: number;
  totalCashEarned: number;
  unlockedTournamentId: TournamentId | null;
  wonTournamentTrophy: TournamentId | null;
  updatedStandings: TournamentStanding[] | null;
  isTournamentComplete: boolean;
  madeTournamentPodium: boolean;
}

export interface MinimapRacerDot {
  id: string;
  x: number;
  y: number;
  color: string;
  isPlayer: boolean;
}

export interface SplitPlayerTelemetry {
  speedKmh: number;
  gear: number;
  nitro: number;
  shockwaveReady: boolean;
  isNitro: boolean;
  isShockwave: boolean;
  place: number;
  lap: number;
}

export interface HudTelemetry {
  mode: RaceMode;
  phase: 'countdown' | 'racing' | 'slowmo_finish' | 'finished';
  countdownValue: number;
  speedKmh: number;
  rpmRatio: number;
  gear: number;
  nitro: number;
  shockwaveReady: boolean;
  isNitro: boolean;
  isShockwave: boolean;
  isDrifting: boolean;
  isAirborne: boolean;
  boostActive: boolean;
  shieldActive: boolean;
  shieldRemaining: number;
  place: number;
  totalRacers: number;
  lap: number;
  totalLaps: number;
  raceTime: number;
  currentLapTime: number;
  bestLapTime: number | null;
  cameraMode: CameraMode;
  wrongWay: boolean;
  stuntCash: number;
  stuntMultiplier: number;
  takedowns: number;
  hasGhost: boolean;
  ghostBestLap: number | null;
  p2Telemetry: SplitPlayerTelemetry | null;
  minimapRacers: MinimapRacerDot[];
}
