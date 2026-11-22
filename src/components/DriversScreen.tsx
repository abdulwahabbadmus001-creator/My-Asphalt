import { ArrowLeft, Check, Lock, Shield, Sparkles, UserCheck } from 'lucide-react';
import { DRIVER_CATALOG, DRIVER_ORDER } from '../game/catalog';
import type { DriverId, PlayerProfile } from '../game/types';

interface DriversScreenProps {
  profile: PlayerProfile;
  previewDriverId: DriverId;
  onPreviewDriver: (driverId: DriverId) => void;
  onRecruitOrSelectDriver: (driverId: DriverId) => void;
  onBack: () => void;
}

export function DriversScreen({
  profile,
  previewDriverId,
  onPreviewDriver,
  onRecruitOrSelectDriver,
  onBack,
}: DriversScreenProps) {
  const spec = DRIVER_CATALOG[previewDriverId];
  const isUnlocked = profile.unlockedDrivers.includes(previewDriverId);
  const isSelected = profile.selectedDriverId === previewDriverId;
  const canAfford = profile.cash >= spec.price;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-slate-100 transition hover:border-fuchsia-400"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back</span>
          </button>
          <div>
            <h1 className="text-lg font-black uppercase italic tracking-wider text-white sm:text-xl">
              Pro Driver Roster
            </h1>
            <p className="text-[11px] font-semibold text-slate-300">
              Recruit drivers with unique 3D racing suits & passive race perks
            </p>
          </div>
        </div>

        <div className="pointer-events-auto carbon-panel flex items-center gap-3 rounded-xl border border-amber-500/40 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Bankroll
          </span>
          <span className="font-telemetry text-base font-black text-amber-400">
            ${profile.cash.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Middle Right Card (Left side frames 3D Driver + Car in Showroom!) */}
      <div className="my-2 flex flex-1 items-center justify-end">
        <div className="pointer-events-auto carbon-panel flex w-full max-w-md flex-col gap-3 rounded-2xl border border-fuchsia-500/40 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-white/60"
                  style={{ backgroundColor: spec.suitSecondary }}
                />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-fuchsia-300">
                  {spec.role}
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-black uppercase italic text-white">{spec.name}</h2>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Callsign
              </div>
              <div className="text-xs font-black uppercase text-cyan-300">{spec.nickname}</div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-300">{spec.bio}</p>

          {/* Passive Race Perk Highlight */}
          <div className="rounded-xl border border-amber-400/50 bg-amber-500/12 p-3.5">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Passive Race Perk</span>
            </div>
            <div className="mt-1 text-sm font-extrabold text-white">{spec.perkSummary}</div>
          </div>

          {/* Suit Color Preview Badges */}
          <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <div className="flex items-center gap-1.5">
              <span
                className="h-4 w-4 rounded border border-slate-600"
                style={{ backgroundColor: spec.suitPrimary }}
              />
              <span>Suit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-4 w-4 rounded border border-slate-600"
                style={{ backgroundColor: spec.helmetColor }}
              />
              <span>Helmet</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-4 w-4 rounded border border-slate-600"
                style={{ backgroundColor: spec.visorColor }}
              />
              <span>Visor</span>
            </div>
          </div>

          {/* Action CTA */}
          {isSelected ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-500/15 py-2.5 text-xs font-black uppercase tracking-wider text-emerald-300">
              <Check className="h-4 w-4" />
              <span>Active Driver</span>
            </div>
          ) : isUnlocked ? (
            <button
              type="button"
              onClick={() => onRecruitOrSelectDriver(previewDriverId)}
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-cyan-400 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-cyan-300"
            >
              <UserCheck className="h-4 w-4" />
              <span>Select Driver</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAfford}
              onClick={() => onRecruitOrSelectDriver(previewDriverId)}
              className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition ${
                canAfford
                  ? 'bg-gradient-to-r from-amber-400 to-fuchsia-500 text-slate-950 hover:brightness-110'
                  : 'cursor-not-allowed bg-slate-800 text-slate-500'
              }`}
            >
              <Lock className="h-4 w-4" />
              <span>Recruit Driver — ${spec.price.toLocaleString()}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom 6-Driver Roster Cards */}
      <div className="pointer-events-auto grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {DRIVER_ORDER.map((did) => {
          const item = DRIVER_CATALOG[did];
          const unlocked = profile.unlockedDrivers.includes(did);
          const active = profile.selectedDriverId === did;
          const previewing = previewDriverId === did;

          return (
            <button
              key={did}
              type="button"
              onClick={() => onPreviewDriver(did)}
              className={`carbon-panel flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                previewing
                  ? 'border-fuchsia-400 shadow-[0_0_16px_rgba(232,121,249,0.3)]'
                  : 'border-slate-700/80 hover:border-slate-500'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span
                  className="h-2.5 w-6 rounded-full"
                  style={{ backgroundColor: item.suitSecondary }}
                />
                {active ? (
                  <span className="text-[9px] font-black uppercase text-emerald-400">Active</span>
                ) : unlocked ? (
                  <Shield className="h-3.5 w-3.5 text-cyan-400" />
                ) : (
                  <span className="font-telemetry text-[10px] font-black text-amber-300">
                    ${item.price.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="mt-1.5 truncate text-xs font-black text-white">{item.name}</div>
              <div className="truncate text-[10px] font-semibold text-slate-400">{item.role}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
