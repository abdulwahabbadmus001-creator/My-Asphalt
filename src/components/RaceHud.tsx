import {
  Camera,
  Flame,
  Gamepad2,
  Music,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Smartphone,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { MinimapData } from '../game/tracks';
import type {
  GamepadStatus,
  HudTelemetry,
  RadioStation,
  StuntPopup,
} from '../game/types';

type DigitalInputKey = 'throttle' | 'brake' | 'left' | 'right' | 'drift' | 'nitro' | 'shunt';

interface RaceHudProps {
  telemetry: HudTelemetry;
  minimap: MinimapData;
  trackName: string;
  stuntPopups: StuntPopup[];
  gamepadStatus: GamepadStatus;
  paused: boolean;
  muted: boolean;
  musicEnabled: boolean;
  touchControlsEnabled: boolean;
  isCssRotated: boolean;
  tiltEnabled: boolean;
  tiltSupported: boolean;
  radioStation: RadioStation;
  onCycleRadio: () => void;
  onToggleTilt: () => void;
  onAnalogSteerChange: (steer: number) => void;
  onCycleCamera: () => void;
  onTogglePause: () => void;
  onOpenPhotoMode: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onToggleTouch: () => void;
  onRestartRace: () => void;
  onQuitRace: () => void;
  onTouchInputChange: (key: DigitalInputKey, pressed: boolean) => void;
}

function formatTime(sec: number): string {
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  const secs = Math.floor(rem);
  const hundredths = Math.floor((rem - secs) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

function ordinal(n: number): string {
  if (n === 1) return 'ST';
  if (n === 2) return 'ND';
  if (n === 3) return 'RD';
  return 'TH';
}

const POPUP_COLORS: Record<StuntPopup['color'], string> = {
  amber: 'border-amber-400 bg-amber-950/90 text-amber-200',
  cyan: 'border-cyan-400 bg-cyan-950/90 text-cyan-200',
  fuchsia: 'border-fuchsia-400 bg-fuchsia-950/90 text-fuchsia-200',
  emerald: 'border-emerald-400 bg-emerald-950/90 text-emerald-200',
  rose: 'border-rose-400 bg-rose-950/90 text-rose-200',
};

export function RaceHud({
  telemetry,
  minimap,
  trackName,
  stuntPopups,
  gamepadStatus,
  paused,
  muted,
  musicEnabled,
  touchControlsEnabled,
  isCssRotated,
  tiltEnabled,
  tiltSupported,
  radioStation,
  onCycleRadio,
  onToggleTilt,
  onAnalogSteerChange,
  onCycleCamera,
  onTogglePause,
  onOpenPhotoMode,
  onToggleMute,
  onToggleMusic,
  onToggleTouch,
  onRestartRace,
  onQuitRace,
  onTouchInputChange,
}: RaceHudProps) {
  const minimapPolyline = minimap.points
    .map((p) => `${(p.x * 124).toFixed(1)},${(p.y * 124).toFixed(1)}`)
    .join(' ');

  // RPM Arc geometry (semi-circle sweep)
  const rpmRadius = 56;
  const rpmArcLen = Math.PI * rpmRadius;
  const rpmDashOffset = rpmArcLen * (1 - Math.min(1, Math.max(0, telemetry.rpmRatio)));

  const joyPadRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);
  const [joyKnobOffset, setJoyKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const updateJoystickFromPointer = (clientX: number, clientY: number) => {
    const el = joyPadRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dxScreen = clientX - cx;
    const dyScreen = clientY - cy;
    // Remap screen deltas to local landscape-stage coordinates when CSS 90° rotation is active
    const localDx = isCssRotated ? dyScreen : dxScreen;
    const localDy = isCssRotated ? -dxScreen : dyScreen;
    const maxRadius = 38;
    const dist = Math.hypot(localDx, localDy);
    const clampedScale = dist > maxRadius ? maxRadius / dist : 1;
    const kx = localDx * clampedScale;
    const ky = localDy * clampedScale;
    setJoyKnobOffset({ x: kx, y: ky });
    const steer = Math.max(-1, Math.min(1, kx / maxRadius));
    onAnalogSteerChange(Math.abs(steer) < 0.06 ? 0 : steer);
  };

  const resetJoystick = () => {
    joyPointerIdRef.current = null;
    setJoyKnobOffset({ x: 0, y: 0 });
    onAnalogSteerChange(0);
  };

  const bindTouch = (key: DigitalInputKey) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      onTouchInputChange(key, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onTouchInputChange(key, false);
    },
    onPointerCancel: () => onTouchInputChange(key, false),
    onLostPointerCapture: () => onTouchInputChange(key, false),
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none overflow-hidden">
      {/* Purple Shockwave Radial Speed Lines Screen-Edge Overlay */}
      {telemetry.isShockwave && (
        <svg
          className="pointer-events-none fixed inset-0 h-full w-full"
          viewBox="0 0 1280 720"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="shockEdge" cx="50%" cy="50%" r="55%">
              <stop offset="58%" stopColor="rgba(217,70,239,0)" />
              <stop offset="100%" stopColor="rgba(217,70,239,0.42)" />
            </radialGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#shockEdge)" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            const x1 = 640 + Math.cos(angle) * 410;
            const y1 = 360 + Math.sin(angle) * 235;
            const x2 = 640 + Math.cos(angle) * 760;
            const y2 = 360 + Math.sin(angle) * 440;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i % 2 === 0 ? '#f0abfc' : '#38bdf8'}
                strokeWidth={i % 3 === 0 ? '3.5' : '2'}
                strokeOpacity="0.65"
              />
            );
          })}
        </svg>
      )}

      {/* Top Row: Position / Lap / Stunt Cash Left | Timers & Controls Right */}
      <div
        className="flex items-start justify-between p-2.5 sm:p-4"
        style={{
          paddingTop: 'max(0.625rem, env(safe-area-inset-top))',
          paddingLeft: 'max(0.625rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.625rem, env(safe-area-inset-right))',
        }}
      >
        {/* Top-Left: Position, Lap & Stunt Multiplier */}
        <div className="flex flex-col gap-2">
          <div className="flex items-stretch gap-2">
            <div className="carbon-panel carbon-skew flex items-baseline gap-1 rounded-lg border border-amber-400/60 px-3.5 py-2 shadow-xl">
              <div className="carbon-unskew flex items-baseline gap-0.5">
                <span className="font-telemetry text-3xl font-black leading-none text-amber-400 sm:text-4xl">
                  {telemetry.place}
                </span>
                <span className="text-xs font-black text-amber-300">
                  {ordinal(telemetry.place)}
                </span>
                <span className="font-telemetry ml-1 text-xs font-bold text-slate-400">
                  /{telemetry.totalRacers}
                </span>
              </div>
            </div>

            <div className="carbon-panel carbon-skew flex flex-col justify-center rounded-lg border border-slate-700/90 px-3.5 py-1.5 shadow-xl">
              <div className="carbon-unskew">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Lap
                </div>
                <div className="font-telemetry text-lg font-black leading-tight text-white">
                  {telemetry.lap}
                  <span className="text-slate-500">/{telemetry.totalLaps}</span>
                </div>
              </div>
            </div>

            {/* Live Stunt Cash & Multiplier */}
            <div className="carbon-panel carbon-skew hidden flex-col justify-center rounded-lg border border-fuchsia-500/45 px-3 py-1.5 shadow-xl sm:flex">
              <div className="carbon-unskew">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-fuchsia-300">
                  <span>Takedowns: {telemetry.takedowns}</span>
                  <span className="font-telemetry rounded bg-fuchsia-500/25 px-1 text-fuchsia-200">
                    x{telemetry.stuntMultiplier.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-900 border border-slate-700">
                    <div
                      className="h-full transition-all duration-150"
                      style={{
                        width: `${Math.max(0, Math.min(100, (telemetry.integrity / Math.max(1, telemetry.maxIntegrity)) * 100))}%`,
                        backgroundColor:
                          telemetry.integrity < 35 ? '#ef4444' : telemetry.integrity < 65 ? '#f59e0b' : '#10b981',
                      }}
                    />
                  </div>
                  <span className="font-telemetry text-[10px] font-black text-slate-200">
                    {telemetry.integrity}% HP
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex w-fit rounded-md border border-slate-700/80 bg-[#0b101b]/92 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-cyan-300">
              {telemetry.mode === 'splitscreen'
                ? `P1 TOP • ${trackName}`
                : telemetry.mode === 'p2p'
                  ? `P2P 60Hz • ${trackName}`
                  : trackName}
            </div>
            {telemetry.hasGhost && telemetry.ghostBestLap !== null && (
              <div className="inline-flex items-center gap-1 rounded-md border border-cyan-400/60 bg-cyan-950/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-200">
                <span className="font-telemetry">GHOST PB {formatTime(telemetry.ghostBestLap)}</span>
              </div>
            )}
            {telemetry.isBossFight && telemetry.bossName && (
              <div className="inline-flex items-center gap-1 rounded-md border border-rose-500/80 bg-rose-950/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-200">
                <span>1v1 BOSS: {telemetry.bossName}</span>
              </div>
            )}
            {telemetry.eliminationTimer !== null && (
              <div
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                  telemetry.eliminationTimer <= 5
                    ? 'animate-pulse border-rose-400 bg-rose-950/95 text-rose-200'
                    : 'border-amber-400/75 bg-amber-950/90 text-amber-200'
                }`}
              >
                <span className="font-telemetry">ELIMINATION: {telemetry.eliminationTimer.toFixed(1)}s</span>
              </div>
            )}
            {telemetry.rampageTimer !== null && (
              <div className="inline-flex items-center gap-1 rounded-md border border-fuchsia-400/80 bg-fuchsia-950/90 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-fuchsia-200">
                <span className="font-telemetry">
                  RAMPAGE: {telemetry.rampageTimer.toFixed(1)}s • {telemetry.takedowns} KO
                </span>
              </div>
            )}
            {typeof telemetry.heatLevel === 'number' && telemetry.heatLevel > 0 && (
              <div className="inline-flex items-center gap-1 rounded-md border border-rose-500/80 bg-rose-950/90 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-rose-200">
                <span className="font-telemetry">HEAT LVL {telemetry.heatLevel}</span>
                {telemetry.heliLockTimer !== null && telemetry.heliLockTimer !== undefined && (
                  <span className="ml-1 animate-pulse text-amber-300">
                    • HELI LOCK {telemetry.heliLockTimer.toFixed(1)}s!
                  </span>
                )}
              </div>
            )}
            {telemetry.shieldActive && (
              <div className="inline-flex items-center gap-1 rounded-md border border-emerald-400/70 bg-emerald-950/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-200">
                <Shield className="h-3 w-3" />
                <span className="font-telemetry">SHIELD {telemetry.shieldRemaining}s</span>
              </div>
            )}
          </div>
        </div>

        {/* Top-Right: Timers & Compact Utility Controls */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5">
            {gamepadStatus.connected && (
              <div className="hidden items-center gap-1 whitespace-nowrap rounded-lg border border-emerald-400/70 bg-emerald-950/90 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-200 sm:flex">
                <Gamepad2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Controller Connected</span>
              </div>
            )}
            <button
              type="button"
              onClick={onCycleCamera}
              className="carbon-panel flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-200 transition hover:border-cyan-400 hover:text-white"
              title="Switch Camera (C)"
            >
              <Camera className="h-3.5 w-3.5 text-cyan-400" />
              <span>{telemetry.cameraMode}</span>
            </button>

            {tiltSupported && (
              <button
                type="button"
                onClick={onToggleTilt}
                className={`carbon-panel flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                  tiltEnabled
                    ? 'border-amber-400 text-amber-200'
                    : 'border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Toggle Phone Tilt Steering"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Tilt: {tiltEnabled ? 'ON' : 'OFF'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleTouch}
              className={`carbon-panel flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                touchControlsEnabled
                  ? 'border-cyan-400 text-cyan-200'
                  : 'border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Toggle On-Screen Touch Controls"
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Touch</span>
            </button>

            <button
              type="button"
              onClick={onCycleRadio}
              className="carbon-panel flex items-center gap-1 whitespace-nowrap rounded-lg border border-fuchsia-500/50 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-fuchsia-200 hover:border-fuchsia-400"
              title="Switch Radio Station"
            >
              <Music className="h-3.5 w-3.5" />
              <span>
                {radioStation === 'afro_log'
                  ? 'AFRO-LOG'
                  : radioStation === 'drift_phonk'
                    ? 'PHONK'
                    : radioStation === 'cyber_synth'
                      ? 'SYNTH'
                      : 'RADIO OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleMusic}
              className={`carbon-panel flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                musicEnabled
                  ? 'border-fuchsia-500/60 text-fuchsia-300'
                  : 'border-slate-700 text-slate-500'
              }`}
              title="Toggle Synthwave Beat"
              aria-label="Toggle Synthwave Beat"
            >
              <Music className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="carbon-panel flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-200 transition hover:border-amber-400"
              title="Mute / Unmute (M)"
              aria-label="Toggle Mute"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-400" />
              )}
            </button>

            <button
              type="button"
              onClick={onTogglePause}
              className="carbon-panel flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-200 transition hover:border-amber-400"
              title="Pause (Esc / P)"
              aria-label="Pause Race"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>

          <div className="carbon-panel flex items-center gap-3 rounded-lg border border-slate-700/80 px-3 py-1.5 text-right">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Lap Time
              </div>
              <div className="font-telemetry text-sm font-black text-white">
                {formatTime(telemetry.currentLapTime)}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Best
              </div>
              <div className="font-telemetry text-sm font-black text-cyan-300">
                {telemetry.bestLapTime !== null ? formatTime(telemetry.bestLapTime) : '--:--.--'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center-Top Floating Animated Stunt Popups */}
      {stuntPopups.length > 0 && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {stuntPopups.slice(-3).map((pop) => (
            <div
              key={pop.id}
              className={`stunt-popup carbon-skew flex items-center gap-2 rounded-lg border-2 px-4 py-1 shadow-2xl ${POPUP_COLORS[pop.color]}`}
            >
              <div className="carbon-unskew flex items-center gap-2 text-xs font-black uppercase tracking-wider sm:text-sm">
                <span>{pop.label}</span>
                {pop.cash > 0 && (
                  <span className="font-telemetry text-amber-300">+${pop.cash}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Center 3-2-1-GO Gantry Lights */}
      {telemetry.phase === 'countdown' && (
        <div className="fixed inset-0 flex flex-col items-center justify-center">
          <div className="carbon-panel flex flex-col items-center rounded-2xl border border-slate-700 px-8 py-5 shadow-2xl">
            <div className="mb-3 flex items-center gap-3">
              {[3, 2, 1].map((light) => {
                const lit = telemetry.countdownValue <= light;
                return (
                  <div
                    key={light}
                    className="h-5 w-5 rounded-full border-2 border-slate-600 transition-colors"
                    style={{
                      backgroundColor: lit ? '#ef4444' : '#1e293b',
                      boxShadow: lit ? '0 0 18px #ef4444' : 'none',
                    }}
                  />
                );
              })}
            </div>
            <div className="font-telemetry text-7xl font-black italic leading-none text-amber-400">
              {telemetry.countdownValue}
            </div>
            <div className="mt-1.5 text-xs font-extrabold uppercase tracking-[0.25em] text-slate-300">
              Hold W / Up • Shift or Double-Tap Up for Shockwave
            </div>
          </div>
        </div>
      )}

      {/* Slow-Motion Finish Banner */}
      {telemetry.phase === 'slowmo_finish' && (
        <div className="fixed inset-x-0 top-1/4 flex justify-center">
          <div className="carbon-panel carbon-skew rounded-xl border-2 border-amber-400 px-8 py-3 shadow-2xl">
            <div className="carbon-unskew text-center">
              <div className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                Checkered Flag
              </div>
              <div className="font-telemetry text-4xl font-black italic text-amber-400">
                FINISH — P{telemetry.place}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Center Status Pills (Breakdown / Combat Banner / Shockwave / Airborne / Drift / Wrong Way) */}
      {telemetry.phase === 'racing' && (
        <div className="fixed inset-x-0 top-[20%] flex flex-col items-center gap-1.5">
          {telemetry.isBrokenDown && (
            <div className="animate-pulse rounded-lg border-2 border-rose-400 bg-rose-950/95 px-4 py-1 text-xs font-black uppercase tracking-widest text-rose-100 shadow-xl">
              RECHARGING ENERGY CORE... {telemetry.breakdownProgress}%
            </div>
          )}
          {telemetry.combatBanner && (
            <div className="carbon-skew rounded-lg border-2 border-amber-400 bg-slate-950/95 px-5 py-1.5 text-sm font-black uppercase tracking-widest text-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.5)]">
              <span className="carbon-unskew block">{telemetry.combatBanner}</span>
            </div>
          )}
          {telemetry.wrongWay && (
            <div className="rounded-lg border border-rose-500 bg-rose-950/90 px-4 py-1 text-sm font-black uppercase tracking-widest text-rose-200">
              Wrong Way!
            </div>
          )}
          {telemetry.isShockwave ? (
            <div className="carbon-skew rounded-lg border-2 border-fuchsia-400 bg-fuchsia-950/90 px-4 py-1 text-xs font-black uppercase tracking-widest text-fuchsia-200 shadow-[0_0_24px_rgba(217,70,239,0.55)]">
              <span className="carbon-unskew inline-flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-fuchsia-300" />
                Purple Shockwave Active!
              </span>
            </div>
          ) : telemetry.isAirborne ? (
            <div className="rounded-lg border border-cyan-400 bg-cyan-950/90 px-3.5 py-0.5 text-xs font-black uppercase tracking-widest text-cyan-200">
              Airborne Stunt
            </div>
          ) : telemetry.isDrifting ? (
            <div className="rounded-lg border border-amber-400 bg-amber-950/85 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-amber-300">
              Drift Charging Nitro
            </div>
          ) : null}
        </div>
      )}

      {/* Bottom Row: Minimap Left | Speedometer & Shockwave Nitro Right */}
      <div
        className="fixed inset-x-0 bottom-0 flex items-end justify-between p-2.5 sm:p-4"
        style={{
          paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(0.625rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.625rem, env(safe-area-inset-right))',
        }}
      >
        {/* Bottom-Left: Live Top-Down 2D Minimap */}
        <div
          className={`carbon-panel rounded-xl border border-slate-700/90 p-1.5 shadow-2xl sm:p-2 ${
            touchControlsEnabled ? 'mb-20 sm:mb-28' : ''
          }`}
        >
          <svg
            viewBox="0 0 124 124"
            className="block h-20 w-20 sm:h-[124px] sm:w-[124px]"
            aria-label="Track Minimap"
          >
            <polygon
              points={minimapPolyline}
              fill="none"
              stroke="#334155"
              strokeWidth="7"
              strokeLinejoin="round"
            />
            <polygon
              points={minimapPolyline}
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {telemetry.minimapRacers.map((dot) => (
              <circle
                key={dot.id}
                cx={dot.x * 124}
                cy={dot.y * 124}
                r={dot.isPlayer ? 5 : 3.5}
                fill={dot.color}
                stroke={dot.isPlayer ? '#ffffff' : '#020617'}
                strokeWidth={dot.isPlayer ? 1.8 : 1}
              />
            ))}
          </svg>
        </div>

        {/* Bottom-Center Keyboard Hint */}
        {!touchControlsEnabled && (
          <div className="hidden rounded-lg border border-slate-800 bg-[#0b101b]/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 lg:block">
            {telemetry.mode === 'splitscreen'
              ? 'P1: WASD + Space + L-Shift • P2: Arrows + Enter + R-Shift • Esc Pause / Photo'
              : 'WASD / Arrows Drive • Space Drift • Shift / Double-Tap Up Nitro • C Cam • Esc Photo'}
          </div>
        )}

        {/* Bottom-Right: Digital Speedometer + RPM Arc + Shockwave Nitro Gauge (Single-Viewport Modes) */}
        {telemetry.mode !== 'splitscreen' && (
        <div
          className={`carbon-panel origin-bottom-right scale-90 sm:scale-100 flex items-end gap-3 rounded-2xl border p-2.5 sm:p-3 shadow-2xl ${
            telemetry.isShockwave
              ? 'border-fuchsia-400 shadow-[0_0_24px_rgba(217,70,239,0.45)]'
              : 'border-slate-700/90'
          } ${touchControlsEnabled ? 'mb-20 sm:mb-28' : ''}`}
        >
          {/* Nitro / Shockwave Vertical Gauge */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider">
              {telemetry.isShockwave || telemetry.shockwaveReady ? (
                <span className="text-fuchsia-300">SHOCK</span>
              ) : (
                <span className="text-cyan-300">NOS</span>
              )}
            </div>
            <div className="relative h-24 w-4 overflow-hidden rounded-full border border-slate-700 bg-slate-950">
              <div
                className="absolute inset-x-0 bottom-0 rounded-full transition-all duration-75"
                style={{
                  height: `${telemetry.nitro}%`,
                  background:
                    telemetry.isShockwave || telemetry.shockwaveReady
                      ? 'linear-gradient(to top, #c026d3, #f0abfc)'
                      : 'linear-gradient(to top, #0284c7, #38bdf8)',
                }}
              />
            </div>
            <span
              className={`font-telemetry text-[10px] font-black ${
                telemetry.shockwaveReady || telemetry.isShockwave
                  ? 'text-fuchsia-300'
                  : 'text-cyan-300'
              }`}
            >
              {telemetry.nitro}%
            </span>
          </div>

          {/* RPM Tachometer Arc & Digital Speedometer */}
          <div className="relative flex h-24 w-36 flex-col items-center justify-end">
            <svg
              viewBox="0 0 136 80"
              className="absolute inset-x-0 top-0 h-20 w-36"
              aria-hidden="true"
            >
              <path
                d="M 12 72 A 56 56 0 0 1 124 72"
                fill="none"
                stroke="#1e293b"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 12 72 A 56 56 0 0 1 124 72"
                fill="none"
                stroke={
                  telemetry.isShockwave
                    ? '#e879f9'
                    : telemetry.rpmRatio > 0.85
                      ? '#ef4444'
                      : telemetry.isNitro
                        ? '#38bdf8'
                        : '#f59e0b'
                }
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={rpmArcLen}
                strokeDashoffset={rpmDashOffset}
              />
            </svg>

            <div className="relative z-10 flex flex-col items-center">
              <span
                className={`font-telemetry text-4xl font-black italic leading-none ${
                  telemetry.isShockwave ? 'text-fuchsia-300' : 'text-white'
                }`}
              >
                {telemetry.speedKmh}
              </span>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-400">KM/H</span>
                <span className="font-telemetry rounded bg-amber-500/20 px-1.5 text-amber-300">
                  G{telemetry.gear}
                </span>
              </div>
              {telemetry.shockwaveReady && (
                <div className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-fuchsia-300">
                  Shockwave Ready!
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Landscape On-Screen Multi-Touch Arcade Controls (Auto-Accelerate Active) */}
      {touchControlsEnabled && telemetry.phase !== 'finished' && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-between px-3 pb-2.5"
          style={{
            paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          }}
        >
          {/* Bottom-Left: Virtual Analog Joystick (pointerId tracked) */}
          <div className="pointer-events-auto flex items-center gap-2.5">
            <div
              ref={joyPadRef}
              onPointerDown={(e) => {
                e.preventDefault();
                joyPointerIdRef.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                updateJoystickFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (joyPointerIdRef.current !== e.pointerId) return;
                e.preventDefault();
                updateJoystickFromPointer(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                if (joyPointerIdRef.current !== e.pointerId) return;
                e.preventDefault();
                resetJoystick();
              }}
              onPointerCancel={resetJoystick}
              onLostPointerCapture={resetJoystick}
              className="relative flex h-28 w-28 touch-none items-center justify-center rounded-full border-2 border-slate-400/55 bg-[#0b101b]/65 shadow-xl sm:h-32 sm:w-32"
              role="slider"
              aria-label="Steering Joystick"
              aria-valuemin={-1}
              aria-valuemax={1}
              aria-valuenow={Math.round((joyKnobOffset.x / 38) * 100) / 100}
            >
              <div className="pointer-events-none absolute inset-x-3 flex justify-between text-xs font-black text-slate-400/75">
                <span>◀</span>
                <span>▶</span>
              </div>
              <div
                className="pointer-events-none h-12 w-12 rounded-full border-2 border-cyan-300/90 bg-cyan-500/35 shadow-[0_0_16px_rgba(34,211,238,0.45)]"
                style={{
                  transform: `translate3d(${joyKnobOffset.x}px, ${joyKnobOffset.y}px, 0)`,
                }}
              />
            </div>
          </div>

          {/* Bottom-Right: Drift / Brake & Nitro / Shockwave (Auto-Accelerate Enabled) */}
          <div className="pointer-events-auto flex items-end gap-2.5">
            <div className="flex flex-col items-center gap-1">
              <span className="rounded bg-emerald-950/75 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300 border border-emerald-500/40">
                Auto Gas
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  {...bindTouch('shunt')}
                  className={`flex h-14 w-16 touch-none flex-col items-center justify-center rounded-2xl border-2 text-[11px] font-black uppercase sm:h-16 sm:w-20 ${
                    telemetry.shuntReady
                      ? 'border-orange-400 bg-orange-950/65 text-orange-200 active:bg-orange-500/40'
                      : 'border-slate-700 bg-slate-900/50 text-slate-500'
                  }`}
                >
                  Shunt
                </button>
                <button
                  type="button"
                  {...bindTouch('brake')}
                  className="flex h-14 w-16 touch-none flex-col items-center justify-center rounded-2xl border-2 border-rose-500/65 bg-rose-950/60 text-[11px] font-black uppercase text-rose-200 active:bg-rose-500/40 sm:h-16 sm:w-20"
                >
                  Brake
                </button>
                <button
                  type="button"
                  {...bindTouch('drift')}
                  className="flex h-16 w-20 touch-none flex-col items-center justify-center rounded-2xl border-2 border-amber-400/70 bg-amber-950/60 text-xs font-black uppercase text-amber-200 active:bg-amber-500/40 sm:h-20 sm:w-24"
                >
                  Drift
                </button>
              </div>
            </div>
            <button
              type="button"
              {...bindTouch('nitro')}
              className={`flex h-20 w-20 touch-none flex-col items-center justify-center gap-0.5 rounded-2xl border-2 text-xs font-black uppercase transition-colors sm:h-24 sm:w-24 ${
                telemetry.shockwaveReady || telemetry.isShockwave
                  ? 'border-fuchsia-400 bg-fuchsia-950/70 text-fuchsia-200 shadow-[0_0_20px_rgba(217,70,239,0.45)] active:bg-fuchsia-500/45'
                  : 'border-cyan-400/75 bg-cyan-950/65 text-cyan-200 active:bg-cyan-500/40'
              }`}
            >
              <Flame className="h-5 w-5" />
              <span>{telemetry.shockwaveReady ? 'Shock' : 'Nitro'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 2-Player Local Split-Screen: P1 Gauge (Top Viewport), Center Divider, P2 Bar (Bottom Viewport) */}
      {telemetry.mode === 'splitscreen' && telemetry.p2Telemetry && (
        <>
          {/* P1 Compact Speed & Nitro Gauge (Bottom-Right of Top Viewport) */}
          <div className="pointer-events-none fixed bottom-[calc(50%+10px)] right-3 z-20 sm:right-4">
            <div className="carbon-panel flex items-center gap-3 rounded-lg border border-amber-400/70 px-3 py-1.5 shadow-xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                P1
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300">
                  {telemetry.shockwaveReady || telemetry.isShockwave ? 'SHOCK' : 'NOS'}
                </span>
                <div className="h-2.5 w-20 overflow-hidden rounded-full border border-slate-700 bg-slate-950">
                  <div
                    className="h-full transition-all duration-75"
                    style={{
                      width: `${telemetry.nitro}%`,
                      background:
                        telemetry.isShockwave || telemetry.shockwaveReady
                          ? 'linear-gradient(to right, #c026d3, #f0abfc)'
                          : 'linear-gradient(to right, #0284c7, #38bdf8)',
                    }}
                  />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-telemetry text-xl font-black italic text-white">
                  {telemetry.speedKmh}
                </span>
                <span className="text-[9px] font-black uppercase text-slate-400">KM/H</span>
                <span className="font-telemetry rounded bg-amber-500/25 px-1 text-[10px] font-black text-amber-300">
                  G{telemetry.gear}
                </span>
              </div>
            </div>
          </div>

          <div className="pointer-events-none fixed inset-x-0 top-1/2 z-20 h-[3px] -translate-y-1/2 border-y border-cyan-400/70 bg-slate-950" />
          <div className="pointer-events-none fixed inset-x-0 top-[calc(50%+8px)] z-20 flex items-start justify-between px-3 sm:px-4">
            <div className="flex items-center gap-2">
              <div className="carbon-panel carbon-skew rounded-lg border border-rose-500/75 px-3 py-1 shadow-xl">
                <div className="carbon-unskew flex items-baseline gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                    P2
                  </span>
                  <span className="font-telemetry text-xl font-black text-white">
                    {telemetry.p2Telemetry.place}
                    {ordinal(telemetry.p2Telemetry.place)}
                  </span>
                  <span className="font-telemetry text-[11px] font-bold text-slate-400">
                    • Lap {telemetry.p2Telemetry.lap}/{telemetry.totalLaps}
                  </span>
                </div>
              </div>
            </div>

            <div className="carbon-panel flex items-center gap-3 rounded-lg border border-rose-500/60 px-3 py-1.5 shadow-xl">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300">
                  {telemetry.p2Telemetry.shockwaveReady || telemetry.p2Telemetry.isShockwave
                    ? 'SHOCK'
                    : 'NOS'}
                </span>
                <div className="h-2.5 w-20 overflow-hidden rounded-full border border-slate-700 bg-slate-950">
                  <div
                    className="h-full transition-all duration-75"
                    style={{
                      width: `${telemetry.p2Telemetry.nitro}%`,
                      background:
                        telemetry.p2Telemetry.isShockwave || telemetry.p2Telemetry.shockwaveReady
                          ? 'linear-gradient(to right, #c026d3, #f0abfc)'
                          : 'linear-gradient(to right, #0284c7, #38bdf8)',
                    }}
                  />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-telemetry text-xl font-black italic text-white">
                  {telemetry.p2Telemetry.speedKmh}
                </span>
                <span className="text-[9px] font-black uppercase text-slate-400">KM/H</span>
                <span className="font-telemetry rounded bg-rose-500/25 px-1 text-[10px] font-black text-rose-300">
                  G{telemetry.p2Telemetry.gear}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Pause Modal */}
      {paused && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#060911]/88 p-4">
          <div className="carbon-panel flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-slate-700 p-6 text-center shadow-2xl">
            <h2 className="text-2xl font-black uppercase italic tracking-wider text-white">
              Race Paused
            </h2>
            <p className="text-xs text-slate-400">
              {trackName} • Lap {telemetry.lap}/{telemetry.totalLaps}
            </p>
            <button
              type="button"
              onClick={onTogglePause}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-300"
            >
              <Play className="h-4 w-4" />
              <span>Resume Race</span>
            </button>
            <button
              type="button"
              onClick={onOpenPhotoMode}
              className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/75 bg-cyan-500/15 py-2.5 text-xs font-black uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/25"
            >
              <Camera className="h-4 w-4" />
              <span>Photo Mode</span>
            </button>
            <button
              type="button"
              onClick={onRestartRace}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:border-cyan-400"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Restart Race</span>
            </button>
            <button
              type="button"
              onClick={onQuitRace}
              className="rounded-xl border border-rose-500/40 bg-rose-950/40 py-2.5 text-xs font-black uppercase tracking-wider text-rose-200 transition hover:bg-rose-900/50"
            >
              Exit To Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
