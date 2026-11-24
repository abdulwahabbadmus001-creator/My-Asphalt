import { useCallback, useEffect, useRef, useState } from 'react';
import { CareerScreen } from './components/CareerScreen';
import { DriverLicenseModal } from './components/DriverLicenseModal';
import { DriversScreen } from './components/DriversScreen';
import { GarageScreen } from './components/GarageScreen';
import { MultiplayerScreen } from './components/MultiplayerScreen';
import { PhotoModeOverlay } from './components/PhotoModeOverlay';
import { PodiumScreen } from './components/PodiumScreen';
import { RaceHud } from './components/RaceHud';
import { TitleScreen } from './components/TitleScreen';
import { audioEngine } from './game/audio';
import { generateDailyChallenge } from './game/dailyChallenge';
import { hapticsEngine } from './game/haptics';
import { tiltSteering } from './game/tiltSteering';
import {
  createInitialStandings,
  TOURNAMENT_CATALOG,
  TRACK_CATALOG,
} from './game/catalog';
import { gamepadManager } from './game/gamepad';
import { OfflineP2PManager, type P2PConnectionStatus } from './game/p2p';
import { finalizeRaceResults, type RaceWorld } from './game/physics';
import { GameSceneManager } from './game/sceneManager';
import {
  buyOrEquipCombatModInProfile,
  buyOrToggleCarToolInProfile,
  loadProfile,
  recruitOrSelectDriverInProfile,
  saveProfile,
  unlockOrEquipCarInProfile,
  updateCarCustomizationInProfile,
  upgradeCarStatInProfile,
} from './game/storage';
import {
  decodeGhostChallengeCode,
  encodeGhostChallengeCode,
  loadTrackGhost,
  saveTrackGhost,
} from './game/ghost';
import { getTrackData } from './game/tracks';
import type {
  CarCustomization,
  CarId,
  CarToolId,
  CombatModId,
  DailyMutatorId,
  DriverId,
  GamepadStatus,
  GameScreen,
  GraphicsQuality,
  HudTelemetry,
  InputState,
  PhotoModeSettings,
  PlayerProfile,
  RaceMode,
  RaceResultSummary,
  RadioStation,
  StuntPopup,
  TournamentId,
  TrackId,
  UpgradeStatKey,
  WeatherTimeOfDay,
} from './game/types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const EMPTY_INPUT: InputState = {
  throttle: false,
  brake: false,
  left: false,
  right: false,
  drift: false,
  nitro: false,
};

const DEFAULT_PHOTO_SETTINGS: PhotoModeSettings = {
  active: false,
  focalLengthMm: 35,
  rollDeg: 0,
  motionBlur: 0.25,
  colorGrade: 'natural',
  hideUi: false,
};

function getInitialTrackFromUrl(): TrackId {
  if (typeof window === 'undefined') return 'coastal';
  const param = new URLSearchParams(window.location.search).get('track');
  if (param === 'coastal' || param === 'desert' || param === 'night' || param === 'alpine') {
    return param;
  }
  return 'coastal';
}

function computeIsCssLandscapeStage(): boolean {
  if (typeof window === 'undefined') return false;
  const isTouchOrCompact =
    window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1024;
  return isTouchOrCompact && window.innerHeight > window.innerWidth;
}

interface ActiveRaceConfig {
  mode: RaceMode;
  trackId: TrackId;
  weatherTime?: WeatherTimeOfDay;
  dailyMutator?: DailyMutatorId;
  tournamentId?: TournamentId;
  raceIndex?: number;
  remotePeer?: {
    name: string;
    carId: CarId;
    bodyColor: string;
  };
}

export default function App() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [screen, setScreen] = useState<GameScreen>(() => {
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1'
    ) {
      return 'race';
    }
    return 'title';
  });
  const [selectedQuickTrack, setSelectedQuickTrack] = useState<TrackId>(() =>
    getInitialTrackFromUrl()
  );
  const [selectedQuickMode, setSelectedQuickMode] = useState<RaceMode>('quick');
  const [selectedWeather, setSelectedWeather] = useState<WeatherTimeOfDay>('noon');
  const [ghostImportMsg, setGhostImportMsg] = useState<string>('');
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [garagePreviewCarId, setGaragePreviewCarId] = useState<CarId>(
    () => loadProfile().selectedCarId
  );
  const [driverPreviewId, setDriverPreviewId] = useState<DriverId>(
    () => loadProfile().selectedDriverId
  );

  const [isCssLandscapeStage, setIsCssLandscapeStage] = useState<boolean>(() =>
    computeIsCssLandscapeStage()
  );
  const [tiltEnabled, setTiltEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isMobileOrTablet =
      window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1024;
    return isMobileOrTablet && tiltSteering.isSupported();
  });

  const [paused, setPaused] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<TrackId>(() => getInitialTrackFromUrl());
  const [activeRaceConfig, setActiveRaceConfig] = useState<ActiveRaceConfig>(() => ({
    mode: 'quick',
    trackId: getInitialTrackFromUrl(),
  }));
  const [telemetry, setTelemetry] = useState<HudTelemetry | null>(null);
  const [stuntPopups, setStuntPopups] = useState<StuntPopup[]>([]);
  const [raceResult, setRaceResult] = useState<RaceResultSummary | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Photo Mode state
  const [photoSettings, setPhotoSettings] = useState<PhotoModeSettings>(DEFAULT_PHOTO_SETTINGS);
  const [snapshotSavedFlash, setSnapshotSavedFlash] = useState(false);

  // Bluetooth Controller state
  const [gamepadStatus, setGamepadStatus] = useState<GamepadStatus>({
    connected: false,
    name: '',
    active: false,
  });

  // Offline P2P WebRTC state
  const [p2pStatus, setP2pStatus] = useState<P2PConnectionStatus>('idle');
  const [p2pDetail, setP2pDetail] = useState<string>('');

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<GameSceneManager | null>(null);
  const p2pManagerRef = useRef<OfflineP2PManager | null>(null);
  const profileRef = useRef<PlayerProfile>(profile);
  const activeRaceConfigRef = useRef<ActiveRaceConfig>(activeRaceConfig);
  const photoActiveRef = useRef<boolean>(false);

  const keyInputRef = useRef<InputState>({ ...EMPTY_INPUT });
  const keyInputP2Ref = useRef<InputState>({ ...EMPTY_INPUT });
  const touchInputRef = useRef<InputState>({ ...EMPTY_INPUT });
  const gamepadInputRef = useRef<InputState>({ ...EMPTY_INPUT });
  const doubleTapNitroUntilRef = useRef<number>(0);
  const lastUpPressRef = useRef<number>(0);

  profileRef.current = profile;
  activeRaceConfigRef.current = activeRaceConfig;
  photoActiveRef.current = photoSettings.active;

  const pushMergedInput = useCallback(() => {
    const k = keyInputRef.current;
    const t = touchInputRef.current;
    const g = gamepadInputRef.current;
    const doubleTapActive = performance.now() < doubleTapNitroUntilRef.current;
    const autoThrottle =
      profileRef.current.touchControlsEnabled &&
      activeRaceConfigRef.current.mode !== 'splitscreen' &&
      !t.brake &&
      !k.brake;

    const tiltVal = tiltSteering.isEnabled() ? tiltSteering.sampleSteer() : 0;
    const touchSteer = typeof t.analogSteer === 'number' ? t.analogSteer : 0;
    const padSteer = typeof g.analogSteer === 'number' ? g.analogSteer : 0;
    const combinedAnalogSteer =
      Math.abs(touchSteer) > 0.04
        ? touchSteer
        : Math.abs(padSteer) > 0.04
          ? padSteer
          : Math.abs(tiltVal) > 0.01
            ? tiltVal
            : undefined;

    sceneRef.current?.setInputState({
      throttle: k.throttle || t.throttle || g.throttle || autoThrottle,
      brake: k.brake || t.brake || g.brake,
      left: k.left || t.left || g.left,
      right: k.right || t.right || g.right,
      drift: k.drift || t.drift || g.drift,
      nitro: k.nitro || t.nitro || g.nitro || doubleTapActive,
      shunt: k.shunt || t.shunt,
      analogSteer: combinedAnalogSteer,
      analogThrottle: g.analogThrottle,
      analogBrake: g.analogBrake,
    });
    sceneRef.current?.setPlayer2InputState({ ...keyInputP2Ref.current });
  }, []);

  const launchRace = useCallback(
    (config: ActiveRaceConfig, profileOverride?: PlayerProfile) => {
      audioEngine.unlock();
      tiltSteering.calibrate();
      keyInputRef.current = { ...EMPTY_INPUT };
      keyInputP2Ref.current = { ...EMPTY_INPUT };
      touchInputRef.current = { ...EMPTY_INPUT };
      doubleTapNitroUntilRef.current = 0;
      pushMergedInput();

      const activeProfile = profileOverride ?? profileRef.current;
      setPaused(false);
      setPhotoSettings({ ...DEFAULT_PHOTO_SETTINGS, active: false });
      setRaceResult(null);
      setStuntPopups([]);
      setActiveTrackId(config.trackId);
      setActiveRaceConfig(config);
      setScreen('race');

      if (config.mode === 'p2p' && p2pManagerRef.current) {
        sceneRef.current?.setP2PManager(p2pManagerRef.current);
      } else {
        sceneRef.current?.setP2PManager(null);
      }

      sceneRef.current?.startRace({
        mode: config.mode,
        trackId: config.trackId,
        weatherTime: config.weatherTime,
        dailyMutator: config.dailyMutator,
        tournamentId: config.tournamentId,
        raceIndex: config.raceIndex,
        profile: activeProfile,
        remotePeer: config.remotePeer,
      });
    },
    [pushMergedInput]
  );

  // Create persistent OfflineP2PManager once
  if (!p2pManagerRef.current) {
    p2pManagerRef.current = new OfflineP2PManager(
      (status, detail) => {
        setP2pStatus(status);
        setP2pDetail(detail ?? '');
      },
      (packet) => {
        if (packet.type === 'start') {
          launchRace({
            mode: 'p2p',
            trackId: packet.trackId,
            remotePeer: {
              name: packet.hostName,
              carId: packet.hostCarId,
              bodyColor: packet.hostColor,
            },
          });
        }
      }
    );
  }

  // Persist profile and sync audio/music/haptics settings
  useEffect(() => {
    saveProfile(profile);
    audioEngine.setVolume(profile.volume, profile.muted);
    audioEngine.setMusicEnabled(profile.musicEnabled);
    if (profile.radioStation) {
      audioEngine.setRadioStation(profile.radioStation);
    }
    hapticsEngine.setEnabled(profile.hapticsEnabled ?? true);
  }, [profile]);

  // Sync tiltSteering controller with toggle state
  useEffect(() => {
    tiltSteering.setEnabled(tiltEnabled);
    if (tiltEnabled) {
      tiltSteering.startListening();
    }
  }, [tiltEnabled]);

  // Instant fullscreen landscape + Web Audio + Gyroscope unlock on initial user interaction
  useEffect(() => {
    let triggered = false;
    const triggerLandscapeAndAudio = async () => {
      audioEngine.unlock();
      if (triggered) return;
      triggered = true;

      if (tiltSteering.isSupported()) {
        await tiltSteering.requestPermissionAndStart();
      }
      try {
        await document.documentElement.requestFullscreen?.().catch(() => {});
        await (
          window.screen.orientation as unknown as { lock?: (o: string) => Promise<void> }
        )?.lock?.('landscape').catch(() => {});
      } catch {
        // Fallback CSS landscape stage handles browsers that disallow orientation.lock()
      }
    };

    // Best-effort attempt on mount
    (window.screen.orientation as unknown as { lock?: (o: string) => Promise<void> })
      ?.lock?.('landscape')
      ?.catch(() => {});

    window.addEventListener('pointerdown', triggerLandscapeAndAudio, { capture: true, passive: true });
    window.addEventListener('click', triggerLandscapeAndAudio, { capture: true, passive: true });
    window.addEventListener('touchstart', triggerLandscapeAndAudio, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', triggerLandscapeAndAudio, { capture: true });
      window.removeEventListener('click', triggerLandscapeAndAudio, { capture: true });
      window.removeEventListener('touchstart', triggerLandscapeAndAudio, { capture: true });
    };
  }, []);

  // Automatic CSS landscape stage listener for mobile/tablet viewports
  useEffect(() => {
    const onResize = () => {
      const nextCssRotated = computeIsCssLandscapeStage();
      setIsCssLandscapeStage(nextCssRotated);
      sceneRef.current?.setCssRotated(nextCssRotated);
      window.requestAnimationFrame(() => {
        sceneRef.current?.resize();
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Capture PWA beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleRaceFinished = useCallback((world: RaceWorld) => {
    const { summary, updatedProfile } = finalizeRaceResults(world, profileRef.current);
    setProfile(updatedProfile);
    setRaceResult(summary);
    setScreen('podium');
  }, []);

  const handleStuntPopups = useCallback((incoming: StuntPopup[]) => {
    if (incoming.length === 0) return;
    setStuntPopups((prev) => [...prev.slice(-4), ...incoming]);
    const ids = new Set(incoming.map((p) => p.id));
    window.setTimeout(() => {
      setStuntPopups((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 1850);
  }, []);

  // Mount Three.js Scene Manager once
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const manager = new GameSceneManager(el, {
      onTelemetry: (t) => setTelemetry(t),
      onStuntPopups: handleStuntPopups,
      onRaceFinished: handleRaceFinished,
    });
    sceneRef.current = manager;
    manager.setCssRotated(computeIsCssLandscapeStage());
    manager.setQuality(profileRef.current.graphicsQuality);

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const tid = getInitialTrackFromUrl();
      setActiveTrackId(tid);
      setActiveRaceConfig({ mode: 'quick', trackId: tid });
      manager.startRace({ mode: 'quick', trackId: tid, profile: profileRef.current });
    } else {
      const p = profileRef.current;
      const hasAero = (p.equippedTools[p.selectedCarId] ?? []).includes('aero');
      manager.showShowroom(
        p.selectedCarId,
        p.customizations[p.selectedCarId],
        hasAero,
        p.selectedDriverId,
        'title'
      );
    }

    return () => {
      p2pManagerRef.current?.close();
      manager.dispose();
      sceneRef.current = null;
    };
  }, [handleRaceFinished, handleStuntPopups]);

  // Sync Showroom car, driver & camera preset when outside active racing
  useEffect(() => {
    const manager = sceneRef.current;
    if (!manager || screen === 'race') return;

    const showCarId = screen === 'garage' ? garagePreviewCarId : profile.selectedCarId;
    const showDriverId = screen === 'drivers' ? driverPreviewId : profile.selectedDriverId;
    const hasAero = (profile.equippedTools[showCarId] ?? []).includes('aero');
    const preset =
      screen === 'garage'
        ? 'garage'
        : screen === 'drivers'
          ? 'drivers'
          : screen === 'career'
            ? 'career'
            : screen === 'podium'
              ? 'podium'
              : 'title';

    manager.showShowroom(
      showCarId,
      profile.customizations[showCarId],
      hasAero,
      showDriverId,
      preset
    );
  }, [
    screen,
    garagePreviewCarId,
    driverPreviewId,
    profile.selectedCarId,
    profile.selectedDriverId,
    profile.customizations,
    profile.equippedTools,
  ]);

  // Bluetooth Controller / Web Gamepad API live polling loop
  useEffect(() => {
    let raf = 0;
    let lastConnected = false;
    let lastName = '';

    const pollLoop = () => {
      const sample = gamepadManager.poll();
      if (sample.status.connected !== lastConnected || sample.status.name !== lastName) {
        lastConnected = sample.status.connected;
        lastName = sample.status.name;
        setGamepadStatus(sample.status);
      }

      if (screen === 'race' && !photoActiveRef.current) {
        gamepadInputRef.current = sample.input;
        pushMergedInput();
        if (sample.events.pausePressed) {
          setPaused((prev) => {
            const next = !prev;
            sceneRef.current?.setPaused(next);
            return next;
          });
        }
        if (sample.events.cameraPressed) {
          sceneRef.current?.cycleCameraMode();
        }
      }
      raf = requestAnimationFrame(pollLoop);
    };

    raf = requestAnimationFrame(pollLoop);
    return () => cancelAnimationFrame(raf);
  }, [screen, pushMergedInput]);

  // Periodically clear expired double-tap Nitro boost window
  useEffect(() => {
    if (screen !== 'race') return;
    const id = window.setInterval(() => {
      if (
        doubleTapNitroUntilRef.current > 0 &&
        performance.now() >= doubleTapNitroUntilRef.current
      ) {
        doubleTapNitroUntilRef.current = 0;
        pushMergedInput();
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [screen, pushMergedInput]);

  // Keyboard Controls during Race & Photo Mode (including Split-Screen P1/P2 separation!)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const code = e.code;

      // Photo Mode hotkeys (H toggles HUD, Esc exits Photo Mode)
      if (photoActiveRef.current) {
        if (code === 'KeyH') {
          e.preventDefault();
          setPhotoSettings((prev) => {
            const next = { ...prev, hideUi: !prev.hideUi };
            sceneRef.current?.updatePhotoSettings(next);
            return next;
          });
          return;
        }
        if (code === 'Escape') {
          e.preventDefault();
          sceneRef.current?.exitPhotoMode();
          setPhotoSettings((prev) => ({ ...prev, active: false, hideUi: false }));
          return;
        }
        return;
      }

      if (screen !== 'race') return;

      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        setPaused((prev) => {
          const next = !prev;
          sceneRef.current?.setPaused(next);
          return next;
        });
        return;
      }
      if (code === 'KeyC') {
        e.preventDefault();
        sceneRef.current?.cycleCameraMode();
        return;
      }
      if (code === 'KeyM') {
        e.preventDefault();
        setProfile((p) => ({ ...p, muted: !p.muted }));
        return;
      }

      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }

      const isSplit = activeRaceConfigRef.current.mode === 'splitscreen';
      const k1 = keyInputRef.current;
      const k2 = keyInputP2Ref.current;

      if (isSplit) {
        // Player 1: WASD + Space (drift) + ShiftLeft (nitro)
        if (code === 'KeyW') k1.throttle = true;
        if (code === 'KeyS') k1.brake = true;
        if (code === 'KeyA') k1.left = true;
        if (code === 'KeyD') k1.right = true;
        if (code === 'Space') k1.drift = true;
        if (code === 'ShiftLeft') k1.nitro = true;

        // Player 2: Arrows + Enter/Slash (drift) + ShiftRight (nitro)
        if (code === 'ArrowUp') k2.throttle = true;
        if (code === 'ArrowDown') k2.brake = true;
        if (code === 'ArrowLeft') k2.left = true;
        if (code === 'ArrowRight') k2.right = true;
        if (code === 'Enter' || code === 'Slash') k2.drift = true;
        if (code === 'ShiftRight') k2.nitro = true;
      } else {
        // Double-tap W / ArrowUp triggers 1.8s Nitro/Shockwave burst
        if ((code === 'KeyW' || code === 'ArrowUp') && !e.repeat) {
          const now = performance.now();
          if (now - lastUpPressRef.current < 320) {
            doubleTapNitroUntilRef.current = now + 1800;
          }
          lastUpPressRef.current = now;
        }
        if (code === 'KeyW' || code === 'ArrowUp') k1.throttle = true;
        if (code === 'KeyS' || code === 'ArrowDown') k1.brake = true;
        if (code === 'KeyA' || code === 'ArrowLeft') k1.left = true;
        if (code === 'KeyD' || code === 'ArrowRight') k1.right = true;
        if (code === 'Space') k1.drift = true;
        if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyN') k1.nitro = true;
        if (code === 'KeyE' || code === 'KeyQ') k1.shunt = true;
      }

      pushMergedInput();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      const isSplit = activeRaceConfigRef.current.mode === 'splitscreen';
      const k1 = keyInputRef.current;
      const k2 = keyInputP2Ref.current;

      if (isSplit) {
        if (code === 'KeyW') k1.throttle = false;
        if (code === 'KeyS') k1.brake = false;
        if (code === 'KeyA') k1.left = false;
        if (code === 'KeyD') k1.right = false;
        if (code === 'Space') k1.drift = false;
        if (code === 'ShiftLeft') k1.nitro = false;

        if (code === 'ArrowUp') k2.throttle = false;
        if (code === 'ArrowDown') k2.brake = false;
        if (code === 'ArrowLeft') k2.left = false;
        if (code === 'ArrowRight') k2.right = false;
        if (code === 'Enter' || code === 'Slash') k2.drift = false;
        if (code === 'ShiftRight') k2.nitro = false;
      } else {
        if (code === 'KeyW' || code === 'ArrowUp') k1.throttle = false;
        if (code === 'KeyS' || code === 'ArrowDown') k1.brake = false;
        if (code === 'KeyA' || code === 'ArrowLeft') k1.left = false;
        if (code === 'KeyD' || code === 'ArrowRight') k1.right = false;
        if (code === 'Space') k1.drift = false;
        if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyN') k1.nitro = false;
        if (code === 'KeyE' || code === 'KeyQ') k1.shunt = false;
      }
      pushMergedInput();
    };

    const onBlur = () => {
      keyInputRef.current = { ...EMPTY_INPUT };
      keyInputP2Ref.current = { ...EMPTY_INPUT };
      touchInputRef.current = { ...EMPTY_INPUT };
      doubleTapNitroUntilRef.current = 0;
      pushMergedInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [screen, pushMergedInput]);

  // ==================== PHOTO MODE HANDLERS ====================

  const handleOpenPhotoMode = (source: 'race' | 'podium') => {
    audioEngine.playUiClick();
    const initial: PhotoModeSettings = {
      ...photoSettings,
      active: true,
      hideUi: false,
    };
    setPhotoSettings(initial);
    sceneRef.current?.enterPhotoMode(source, initial);
  };

  const handleUpdatePhotoSettings = (patch: Partial<PhotoModeSettings>) => {
    setPhotoSettings((prev) => {
      const next = { ...prev, ...patch };
      sceneRef.current?.updatePhotoSettings(next);
      return next;
    });
  };

  const handleExitPhotoMode = () => {
    audioEngine.playUiClick();
    sceneRef.current?.exitPhotoMode();
    setPhotoSettings((prev) => ({ ...prev, active: false, hideUi: false }));
  };

  const handleCaptureSnapshot = () => {
    audioEngine.playUiClick();
    const dataUrl = sceneRef.current?.capturePhotoSnapshot();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `my-asphalt-photo-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSnapshotSavedFlash(true);
    window.setTimeout(() => setSnapshotSavedFlash(false), 1800);
  };

  // ==================== NAVIGATION & ACTION HANDLERS ====================

  const handleQuickRace = () => {
    audioEngine.playUiClick();
    launchRace({ mode: selectedQuickMode, trackId: selectedQuickTrack, weatherTime: selectedWeather });
  };

  const handleStartDailyChallenge = () => {
    audioEngine.playUiClick();
    const daily = generateDailyChallenge();
    launchRace({
      mode: 'quick',
      trackId: daily.trackId,
      weatherTime: daily.weatherTime,
      dailyMutator: daily.mutator,
    });
  };

  const handleCycleRadio = () => {
    audioEngine.playUiClick();
    const order: RadioStation[] = ['cyber_synth', 'afro_log', 'drift_phonk', 'off'];
    const current = profile.radioStation ?? 'cyber_synth';
    const next = order[(order.indexOf(current) + 1) % order.length];
    setProfile((p) => ({ ...p, radioStation: next }));
  };

  const handleImportGhostCode = (code: string) => {
    const decoded = decodeGhostChallengeCode(code);
    if (!decoded) {
      setGhostImportMsg('Invalid Ghost Code');
      return;
    }
    saveTrackGhost(decoded.record);
    setSelectedQuickTrack(decoded.record.trackId);
    setGhostImportMsg(`Loaded ${decoded.record.lapTime.toFixed(2)}s Ghost!`);
  };

  const handleShareGhostCode = async (trackId: TrackId): Promise<string | null> => {
    const ghost = loadTrackGhost(trackId);
    if (!ghost) return null;
    const code = encodeGhostChallengeCode(ghost, profile.customizations[ghost.carId]);
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      // Clipboard may be restricted
    }
    return code;
  };

  const handleStartP2PRaceAsHost = (trackId: TrackId) => {
    const p2p = p2pManagerRef.current;
    if (!p2p) return;
    audioEngine.playUiClick();
    const custom = profile.customizations[profile.selectedCarId];
    p2p.sendPacket({
      type: 'start',
      trackId,
      hostName: profile.playerName,
      hostCarId: profile.selectedCarId,
      hostColor: custom.bodyColor,
    });
    const remote = p2p.getRemoteInfo();
    launchRace({
      mode: 'p2p',
      trackId,
      remotePeer: remote ?? {
        name: 'LAN Rival',
        carId: 'stuttgart_gt3rs',
        bodyColor: '#06b6d4',
      },
    });
  };

  const handleStartSplitScreen = (trackId: TrackId) => {
    audioEngine.playUiClick();
    launchRace({ mode: 'splitscreen', trackId });
  };

  const handleStartOrContinueTournament = (tournamentId: TournamentId) => {
    audioEngine.playUiClick();
    const spec = TOURNAMENT_CATALOG[tournamentId];
    let updatedProfile = profile;
    let raceIdx = 0;

    if (
      profile.activeTournament &&
      profile.activeTournament.tournamentId === tournamentId &&
      !profile.activeTournament.completed
    ) {
      raceIdx = profile.activeTournament.currentRaceIndex;
    } else {
      const playerCustom = profile.customizations[profile.selectedCarId];
      updatedProfile = {
        ...profile,
        activeTournament: {
          tournamentId,
          currentRaceIndex: 0,
          standings: createInitialStandings(
            profile.playerName,
            profile.selectedCarId,
            playerCustom.bodyColor
          ),
          completed: false,
        },
      };
      setProfile(updatedProfile);
    }

    launchRace(
      {
        mode: 'tournament',
        trackId: spec.tracks[raceIdx],
        tournamentId,
        raceIndex: raceIdx,
      },
      updatedProfile
    );
  };

  const handleResetActiveTournament = (tournamentId: TournamentId) => {
    audioEngine.playUiClick();
    const spec = TOURNAMENT_CATALOG[tournamentId];
    const playerCustom = profile.customizations[profile.selectedCarId];
    const updatedProfile: PlayerProfile = {
      ...profile,
      activeTournament: {
        tournamentId,
        currentRaceIndex: 0,
        standings: createInitialStandings(
          profile.playerName,
          profile.selectedCarId,
          playerCustom.bodyColor
        ),
        completed: false,
      },
    };
    setProfile(updatedProfile);
    launchRace(
      {
        mode: 'tournament',
        trackId: spec.tracks[0],
        tournamentId,
        raceIndex: 0,
      },
      updatedProfile
    );
  };

  const handleNextTournamentRace = () => {
    if (!profile.activeTournament || profile.activeTournament.completed) {
      setScreen('career');
      return;
    }
    audioEngine.playUiClick();
    const tId = profile.activeTournament.tournamentId;
    const idx = profile.activeTournament.currentRaceIndex;
    const spec = TOURNAMENT_CATALOG[tId];
    launchRace({
      mode: 'tournament',
      trackId: spec.tracks[idx],
      tournamentId: tId,
      raceIndex: idx,
    });
  };

  const handleToggleQuality = (q: GraphicsQuality) => {
    audioEngine.playUiClick();
    setProfile((p) => ({ ...p, graphicsQuality: q }));
    sceneRef.current?.setQuality(q);
  };

  const handleToggleMute = () => {
    setProfile((p) => ({ ...p, muted: !p.muted }));
  };

  const handleToggleMusic = () => {
    audioEngine.playUiClick();
    setProfile((p) => ({ ...p, musicEnabled: !p.musicEnabled }));
  };

  const handleBuyOrEquipCar = (carId: CarId) => {
    audioEngine.playUiClick();
    setProfile((prev) => unlockOrEquipCarInProfile(prev, carId));
  };

  const handleRecruitOrSelectDriver = (driverId: DriverId) => {
    audioEngine.playUiClick();
    setProfile((prev) => recruitOrSelectDriverInProfile(prev, driverId));
  };

  const handleUpgradeStat = (carId: CarId, stat: UpgradeStatKey) => {
    audioEngine.playUiClick();
    setProfile((prev) => upgradeCarStatInProfile(prev, carId, stat));
  };

  const handleBuyOrToggleTool = (carId: CarId, toolId: CarToolId) => {
    audioEngine.playUiClick();
    setProfile((prev) => buyOrToggleCarToolInProfile(prev, carId, toolId));
  };

  const handleBuyOrEquipCombatMod = (modId: CombatModId) => {
    audioEngine.playUiClick();
    setProfile((prev) => buyOrEquipCombatModInProfile(prev, modId));
  };

  const handleUpdateCustomization = (carId: CarId, patch: Partial<CarCustomization>) => {
    setProfile((prev) => updateCarCustomizationInProfile(prev, carId, patch));
  };

  const handleTouchInput = (
    key: 'throttle' | 'brake' | 'left' | 'right' | 'drift' | 'nitro' | 'shunt',
    pressed: boolean
  ) => {
    touchInputRef.current[key] = pressed;
    pushMergedInput();
  };

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const activeTrackData = getTrackData(activeTrackId);

  return (
    <div
      id="landscape-stage"
      className={
        isCssLandscapeStage
          ? 'is-css-rotated overflow-hidden bg-[#05070d] text-white'
          : 'relative h-[100dvh] w-[100dvw] overflow-hidden bg-[#05070d] text-white'
      }
    >
      {/* Persistent Full-Screen 3D WebGL Canvas */}
      <div ref={canvasContainerRef} className="fixed inset-0 h-full w-full" />

      {/* Title Screen */}
      {screen === 'title' && (
        <TitleScreen
          profile={profile}
          selectedQuickTrack={selectedQuickTrack}
          selectedQuickMode={selectedQuickMode}
          selectedWeather={selectedWeather}
          ghostImportMsg={ghostImportMsg}
          gamepadStatus={gamepadStatus}
          onSelectQuickTrack={(tid) => {
            audioEngine.playUiClick();
            setSelectedQuickTrack(tid);
          }}
          onSelectQuickMode={(m) => {
            audioEngine.playUiClick();
            setSelectedQuickMode(m);
          }}
          onSelectWeather={(w) => {
            audioEngine.playUiClick();
            setSelectedWeather(w);
          }}
          onImportGhostCode={handleImportGhostCode}
          onPlayerNameChange={(name) => setProfile((p) => ({ ...p, playerName: name }))}
          onQuickRace={handleQuickRace}
          onOpenCareer={() => {
            audioEngine.playUiClick();
            setScreen('career');
          }}
          onOpenMultiplayer={() => {
            audioEngine.playUiClick();
            setScreen('multiplayer');
          }}
          onOpenGarage={() => {
            audioEngine.playUiClick();
            setGaragePreviewCarId(profile.selectedCarId);
            setScreen('garage');
          }}
          onOpenDrivers={() => {
            audioEngine.playUiClick();
            setDriverPreviewId(profile.selectedDriverId);
            setScreen('drivers');
          }}
          onOpenLicense={() => {
            audioEngine.playUiClick();
            setShowLicenseModal(true);
          }}
          onStartDailyChallenge={handleStartDailyChallenge}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onToggleQuality={handleToggleQuality}
          canInstallPwa={installPrompt !== null}
          onInstallPwa={handleInstallPwa}
        />
      )}

      {/* Offline P2P Multiplayer & 2-Player Local Split-Screen Lobby */}
      {screen === 'multiplayer' && p2pManagerRef.current && (
        <MultiplayerScreen
          profile={profile}
          p2pManager={p2pManagerRef.current}
          p2pStatus={p2pStatus}
          p2pDetail={p2pDetail}
          onStartP2PRaceAsHost={handleStartP2PRaceAsHost}
          onStartSplitScreen={handleStartSplitScreen}
          onBack={() => {
            audioEngine.playUiClick();
            setScreen('title');
          }}
        />
      )}

      {/* Garage & Car Tools Screen */}
      {screen === 'garage' && (
        <GarageScreen
          profile={profile}
          previewCarId={garagePreviewCarId}
          onPreviewCar={(cid) => {
            audioEngine.playUiClick();
            setGaragePreviewCarId(cid);
          }}
          onBuyOrEquipCar={handleBuyOrEquipCar}
          onUpgradeStat={handleUpgradeStat}
          onBuyOrToggleTool={handleBuyOrToggleTool}
          onBuyOrEquipCombatMod={handleBuyOrEquipCombatMod}
          onUpdateCustomization={handleUpdateCustomization}
          onBack={() => {
            audioEngine.playUiClick();
            setScreen('title');
          }}
        />
      )}

      {/* Pro Driver Roster Screen */}
      {screen === 'drivers' && (
        <DriversScreen
          profile={profile}
          previewDriverId={driverPreviewId}
          onPreviewDriver={(did) => {
            audioEngine.playUiClick();
            setDriverPreviewId(did);
          }}
          onRecruitOrSelectDriver={handleRecruitOrSelectDriver}
          onBack={() => {
            audioEngine.playUiClick();
            setScreen('title');
          }}
        />
      )}

      {/* Progressive 8-Tournament Career Screen */}
      {screen === 'career' && (
        <CareerScreen
          profile={profile}
          onStartOrContinueTournament={handleStartOrContinueTournament}
          onResetActiveTournament={handleResetActiveTournament}
          onOpenGarage={() => {
            audioEngine.playUiClick();
            setGaragePreviewCarId(profile.selectedCarId);
            setScreen('garage');
          }}
          onBack={() => {
            audioEngine.playUiClick();
            setScreen('title');
          }}
        />
      )}

      {/* Live Race HUD (hidden when Photo Mode is active) */}
      {screen === 'race' && telemetry && !photoSettings.active && (
        <RaceHud
          telemetry={telemetry}
          minimap={activeTrackData.minimap}
          trackName={TRACK_CATALOG[activeTrackId].name}
          stuntPopups={stuntPopups}
          gamepadStatus={gamepadStatus}
          paused={paused}
          muted={profile.muted}
          musicEnabled={profile.musicEnabled}
          touchControlsEnabled={profile.touchControlsEnabled}
          isCssRotated={isCssLandscapeStage}
          tiltEnabled={tiltEnabled}
          tiltSupported={tiltSteering.isSupported()}
          radioStation={profile.radioStation ?? 'cyber_synth'}
          onCycleRadio={handleCycleRadio}
          onToggleTilt={() => {
            audioEngine.playUiClick();
            setTiltEnabled((prev) => {
              const next = !prev;
              if (next) {
                tiltSteering.requestPermissionAndStart();
              }
              return next;
            });
          }}
          onAnalogSteerChange={(steer) => {
            touchInputRef.current.analogSteer = steer;
            pushMergedInput();
          }}
          onCycleCamera={() => {
            audioEngine.playUiClick();
            sceneRef.current?.cycleCameraMode();
          }}
          onTogglePause={() => {
            audioEngine.playUiClick();
            setPaused((prev) => {
              const next = !prev;
              sceneRef.current?.setPaused(next);
              return next;
            });
          }}
          onOpenPhotoMode={() => handleOpenPhotoMode('race')}
          onToggleMute={handleToggleMute}
          onToggleMusic={handleToggleMusic}
          onToggleTouch={() =>
            setProfile((p) => ({ ...p, touchControlsEnabled: !p.touchControlsEnabled }))
          }
          onRestartRace={() => {
            audioEngine.playUiClick();
            launchRace(activeRaceConfig);
          }}
          onQuitRace={() => {
            audioEngine.playUiClick();
            setPaused(false);
            sceneRef.current?.setPaused(false);
            setScreen('title');
          }}
          onTouchInputChange={handleTouchInput}
        />
      )}

      {/* Podium & Standings Screen (hidden when Photo Mode is active) */}
      {screen === 'podium' && raceResult && !photoSettings.active && (
        <PodiumScreen
          summary={raceResult}
          onShareGhostCode={() => handleShareGhostCode(raceResult.trackId)}
          onNextRace={handleNextTournamentRace}
          onRetryRace={() => {
            audioEngine.playUiClick();
            launchRace(activeRaceConfig);
          }}
          onOpenPhotoMode={() => handleOpenPhotoMode('podium')}
          onOpenGarage={() => {
            audioEngine.playUiClick();
            setGaragePreviewCarId(profile.selectedCarId);
            setScreen('garage');
          }}
          onOpenCareer={() => {
            audioEngine.playUiClick();
            setScreen('career');
          }}
          onReturnTitle={() => {
            audioEngine.playUiClick();
            setScreen('title');
          }}
        />
      )}

      {/* Cinematic Photo Mode Overlay (from Race Pause OR Podium) */}
      {photoSettings.active && (
        <PhotoModeOverlay
          settings={photoSettings}
          onUpdate={handleUpdatePhotoSettings}
          onResetCamera={() => {
            audioEngine.playUiClick();
            sceneRef.current?.resetPhotoCamera();
          }}
          onCaptureSnapshot={handleCaptureSnapshot}
          onExit={handleExitPhotoMode}
          snapshotSavedFlash={snapshotSavedFlash}
        />
      )}

      {/* Driver License & Mastery Badges Modal */}
      {showLicenseModal && (
        <DriverLicenseModal
          profile={profile}
          onClose={() => {
            audioEngine.playUiClick();
            setShowLicenseModal(false);
          }}
        />
      )}
    </div>
  );
}
