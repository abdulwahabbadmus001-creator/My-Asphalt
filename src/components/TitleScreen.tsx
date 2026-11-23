import {
  Download,
  Flag,
  Gamepad2,
  Music,
  SlidersHorizontal,
  Trophy,
  UserCheck,
  Volume2,
  VolumeX,
  Wifi,
  Wrench,
} from 'lucide-react';
import {
  CAR_CATALOG,
  CLASS_COLORS,
  computeCarPerformance,
  DRIVER_CATALOG,
  TRACK_CATALOG,
  TRACK_ORDER,
} from '../game/catalog';
import type { GamepadStatus, GraphicsQuality, PlayerProfile, TrackId } from '../game/types';

interface TitleScreenProps {
  profile: PlayerProfile;
  selectedQuickTrack: TrackId;
  gamepadStatus: GamepadStatus;
  onSelectQuickTrack: (trackId: TrackId) => void;
  onPlayerNameChange: (name: string) => void;
  onQuickRace: () => void;
  onOpenCareer: () => void;
  onOpenMultiplayer: () => void;
  onOpenGarage: () => void;
  onOpenDrivers: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onToggleQuality: (q: GraphicsQuality) => void;
  canInstallPwa: boolean;
  onInstallPwa: () => void;
}

export function TitleScreen({
  profile,
  selectedQuickTrack,
  gamepadStatus,
  onSelectQuickTrack,
  onPlayerNameChange,
  onQuickRace,
  onOpenCareer,
  onOpenMultiplayer,
  onOpenGarage,
  onOpenDrivers,
  onToggleMute,
  onToggleMusic,
  onToggleQuality,
  canInstallPwa,
  onInstallPwa,
}: TitleScreenProps) {
  const car = CAR_CATALOG[profile.selectedCarId] ?? CAR_CATALOG.civic_gt;
  const driver = DRIVER_CATALOG[profile.selectedDriverId] ?? DRIVER_CATALOG.rookie;
  const tools = profile.equippedTools[profile.selectedCarId] ?? [];
  const perf = computeCarPerformance(
    profile.selectedCarId,
    profile.upgrades[profile.selectedCarId],
    tools,
    driver.perks
  );
  const classStyle = CLASS_COLORS[car.carClass];

  return (
    <div className="pointer-events-none safe-area-pad fixed inset-0 z-10 flex flex-col justify-between overflow-y-auto p-3 sm:p-6">
      {/* Top Bar: Title Lockup + Cash & Audio/Graphics Controls */}
      <div className="flex items-start justify-between gap-4">
        {/* Custom SVG Metallic Lockup — wide viewBox so zero clipping */}
        <div className="pointer-events-auto select-none">
          <svg
            viewBox="0 0 540 94"
            className="h-14 w-auto drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)] sm:h-16"
            role="img"
            aria-label="My Asphalt"
          >
            <defs>
              <linearGradient id="myAsphaltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="48%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#e879f9" />
              </linearGradient>
              <linearGradient id="asphaltSlash" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="55%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#d946ef" />
              </linearGradient>
            </defs>
            <polygon points="10,72 486,72 472,82 0,82" fill="url(#asphaltSlash)" />
            <text
              x="8"
              y="62"
              fill="url(#myAsphaltGrad)"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              fontWeight="900"
              fontStyle="italic"
              fontSize="60"
              letterSpacing="2"
            >
              MY ASPHALT
            </text>
          </svg>
          <div className="mt-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-300">
            <span className="text-amber-400">LEGENDARY ARCADE RACING</span>
            <span className="text-slate-600">|</span>
            <span>8 CUPS • 18 CARS • 6 PROS</span>
          </div>
        </div>

        {/* Top-Right Utility Controls */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          {gamepadStatus.connected && (
            <div className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-400/70 bg-emerald-950/90 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-emerald-200">
              <Gamepad2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Controller Connected</span>
            </div>
          )}

          <div className="carbon-panel flex items-center gap-3 rounded-lg border border-amber-500/40 px-3.5 py-2">
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Bankroll
              </div>
              <div className="font-telemetry text-base font-black text-amber-400">
                ${profile.cash.toLocaleString()}
              </div>
            </div>
            <div className="h-7 w-px bg-slate-700" />
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Cups
              </div>
              <div className="font-telemetry text-base font-black text-cyan-300">
                {profile.trophies.length}/8
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleQuality(profile.graphicsQuality === 'high' ? 'low' : 'high')}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700/90 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:border-cyan-400 hover:text-white"
            title="Toggle Graphics Quality"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-cyan-400" />
            <span>GFX: {profile.graphicsQuality}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMusic}
            className={`carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
              profile.musicEnabled
                ? 'border-fuchsia-500/60 text-fuchsia-200 hover:border-fuchsia-400'
                : 'border-slate-700/90 text-slate-400 hover:text-white'
            }`}
            title="Toggle Synthwave Beat"
          >
            <Music className="h-4 w-4 shrink-0" />
            <span>{profile.musicEnabled ? 'Beat On' : 'Beat Off'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700/90 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:border-amber-400 hover:text-white"
            title="Toggle Sound"
          >
            {profile.muted ? (
              <VolumeX className="h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <span>{profile.muted ? 'Muted' : 'Audio'}</span>
          </button>

          {canInstallPwa && (
            <button
              type="button"
              onClick={onInstallPwa}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-400/70 bg-cyan-500/20 px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-500/35"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>Install</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Dock: Left Driver & Car Card, Right Quick Track & Action CTA */}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        {/* Left: Driver Identity + Equipped Ride PR Card */}
        <div className="pointer-events-auto carbon-panel flex w-full max-w-md flex-col gap-2.5 rounded-xl border border-slate-700/90 p-3.5 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="driver-name-input"
                className="block text-[10px] font-bold uppercase tracking-widest text-slate-400"
              >
                Driver Handle ({driver.role})
              </label>
              <input
                id="driver-name-input"
                type="text"
                maxLength={22}
                value={profile.playerName}
                onChange={(e) => onPlayerNameChange(e.target.value)}
                placeholder="Enter Racer Name"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="shrink-0 rounded-lg border border-slate-700/80 bg-slate-950/90 px-3 py-1.5 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase"
                  style={{
                    backgroundColor: classStyle.bg,
                    color: classStyle.text,
                    border: `1px solid ${classStyle.border}`,
                  }}
                >
                  {car.carClass === 'HYPER' ? 'HYPER' : `Class ${car.carClass}`}
                </span>
                <span className="font-telemetry text-xs font-black text-amber-400">
                  {perf.powerRating} PR
                </span>
              </div>
              <div className="mt-0.5 text-xs font-black text-white">{car.name}</div>
              <div className="font-telemetry text-[10px] text-cyan-300">
                {Math.round(perf.maxSpeedKmh)} KM/H • {tools.length}/5 Tools
              </div>
            </div>
          </div>

          {/* Active Driver Passive Perk Banner */}
          <div className="flex items-center justify-between gap-2 rounded-lg border border-fuchsia-500/35 bg-fuchsia-950/35 px-2.5 py-1.5 text-[11px]">
            <span className="font-extrabold uppercase tracking-wider text-fuchsia-300">
              {driver.name}
            </span>
            <span className="truncate font-semibold text-slate-200">{driver.perkSummary}</span>
          </div>
        </div>

        {/* Right: 4-Track Selector + Main Action Deck */}
        <div className="pointer-events-auto flex flex-col items-end gap-2.5">
          {/* 4-Environment Quick Track Switcher */}
          <div className="carbon-panel flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-700/90 p-1.5">
            {TRACK_ORDER.map((tid) => {
              const t = TRACK_CATALOG[tid];
              const active = selectedQuickTrack === tid;
              return (
                <button
                  key={tid}
                  type="button"
                  onClick={() => onSelectQuickTrack(tid)}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition ${
                    active
                      ? 'bg-cyan-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {tid === 'coastal'
                    ? 'Coastal'
                    : tid === 'desert'
                      ? 'Desert'
                      : tid === 'night'
                        ? 'Rainy Night'
                        : 'Alpine Pass'}
                  <span className="sr-only">{t.name}</span>
                </button>
              );
            })}
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 xl:flex-nowrap xl:gap-2">
            <button
              type="button"
              onClick={onOpenMultiplayer}
              className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-cyan-400/60 bg-cyan-950/40 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-900/50"
            >
              <Wifi className="h-4 w-4 shrink-0 text-cyan-400" />
              <span>Multiplayer (P2P)</span>
            </button>

            <button
              type="button"
              onClick={onOpenDrivers}
              className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-fuchsia-500/50 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-fuchsia-100 transition hover:border-fuchsia-400 hover:bg-fuchsia-950/60"
            >
              <UserCheck className="h-4 w-4 shrink-0 text-fuchsia-400" />
              <span>Drivers</span>
            </button>

            <button
              type="button"
              onClick={onOpenGarage}
              className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-600 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:border-cyan-400 hover:bg-slate-800"
            >
              <Wrench className="h-4 w-4 shrink-0 text-cyan-400" />
              <span>Garage</span>
            </button>

            <button
              type="button"
              onClick={onOpenCareer}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-400/70 bg-amber-500/20 px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/35"
            >
              <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Career (8 Cups)</span>
            </button>

            <button
              type="button"
              onClick={onQuickRace}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-600 px-5 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-[0_0_26px_rgba(245,158,11,0.45)] transition hover:brightness-110 active:scale-[0.98]"
            >
              <Flag className="h-4 w-4 shrink-0" />
              <span>Quick Race</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
