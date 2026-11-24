import { Award, ShieldCheck, X } from 'lucide-react';
import type { PlayerProfile } from '../game/types';

interface DriverLicenseModalProps {
  profile: PlayerProfile;
  onClose: () => void;
}

export function DriverLicenseModal({ profile, onClose }: DriverLicenseModalProps) {
  const stats = profile.lifetimeStats ?? {
    ringOuts: 0,
    wrecks: 0,
    barrelRolls: 0,
    topSpeedKmh: 0,
    policeEscapes: 0,
    bossWins: 0,
  };

  const badges = [
    { id: 'ringout', label: 'Harbor Enforcer', desc: 'Inflict 3+ Splashdown Ring-Outs', unlocked: stats.ringOuts >= 3 },
    { id: 'wrecker', label: 'Road Wrecker', desc: 'Wreck 10+ rival cars', unlocked: stats.wrecks >= 10 },
    { id: 'acrobat', label: 'Sky Acrobat', desc: 'Land 5+ Barrel Rolls', unlocked: stats.barrelRolls >= 5 },
    { id: 'speed', label: 'Hyper Velocity', desc: 'Reach 380+ KM/H', unlocked: stats.topSpeedKmh >= 380 },
    { id: 'outlaw', label: 'Heat Escape', desc: 'Survive a Police Pursuit', unlocked: stats.policeEscapes >= 1 },
    { id: 'champ', label: 'Cup Legend', desc: 'Win a Career Cup Trophy', unlocked: profile.trophies.length >= 1 },
  ];

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="carbon-panel w-full max-w-lg rounded-2xl border border-cyan-400/50 p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-black uppercase italic tracking-wider">
              Driver License • {profile.playerName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-cyan-400 hover:text-white"
            aria-label="Close License"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Ring-Outs</div>
            <div className="font-telemetry text-lg font-black text-cyan-300">{stats.ringOuts}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Wrecks</div>
            <div className="font-telemetry text-lg font-black text-rose-400">{stats.wrecks}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Top Speed</div>
            <div className="font-telemetry text-lg font-black text-amber-400">{stats.topSpeedKmh} km/h</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-300">
            Mastery Badges
          </div>
          <div className="grid grid-cols-2 gap-2">
            {badges.map((b) => (
              <div
                key={b.id}
                className={`flex items-center gap-2 rounded-xl border p-2 text-xs ${
                  b.unlocked
                    ? 'border-amber-400/60 bg-amber-950/30 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-500'
                }`}
              >
                <Award className={`h-4 w-4 shrink-0 ${b.unlocked ? 'text-amber-400' : 'text-slate-600'}`} />
                <div className="min-w-0">
                  <div className="truncate font-black uppercase">{b.label}</div>
                  <div className="truncate text-[10px] opacity-80">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
