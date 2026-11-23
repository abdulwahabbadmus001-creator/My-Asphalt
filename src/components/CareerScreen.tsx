import { AlertTriangle, ArrowLeft, CheckCircle2, Flag, Lock, Trophy, Wrench } from 'lucide-react';
import { useState } from 'react';
import {
  CAR_CATALOG,
  checkCarMeetsTournamentGate,
  CLASS_COLORS,
  computeCarPerformance,
  DRIVER_CATALOG,
  TOURNAMENT_CATALOG,
  TOURNAMENT_ORDER,
  TRACK_CATALOG,
} from '../game/catalog';
import type { PlayerProfile, TournamentId } from '../game/types';

interface CareerScreenProps {
  profile: PlayerProfile;
  onStartOrContinueTournament: (tournamentId: TournamentId) => void;
  onResetActiveTournament: (tournamentId: TournamentId) => void;
  onOpenGarage: () => void;
  onBack: () => void;
}

export function CareerScreen({
  profile,
  onStartOrContinueTournament,
  onResetActiveTournament,
  onOpenGarage,
  onBack,
}: CareerScreenProps) {
  const defaultTid =
    profile.activeTournament?.tournamentId ??
    profile.unlockedTournaments[profile.unlockedTournaments.length - 1] ??
    'rookie_street';

  const [selectedId, setSelectedId] = useState<TournamentId>(defaultTid);

  const selected = TOURNAMENT_CATALOG[selectedId];
  const isUnlocked = profile.unlockedTournaments.includes(selectedId);
  const hasTrophy = profile.trophies.includes(selectedId);
  const activeHere =
    profile.activeTournament && profile.activeTournament.tournamentId === selectedId
      ? profile.activeTournament
      : null;

  const car = CAR_CATALOG[profile.selectedCarId] ?? CAR_CATALOG.civic_gt;
  const driver = DRIVER_CATALOG[profile.selectedDriverId] ?? DRIVER_CATALOG.rookie;
  const perf = computeCarPerformance(
    profile.selectedCarId,
    profile.upgrades[profile.selectedCarId],
    profile.equippedTools[profile.selectedCarId] ?? [],
    driver.perks
  );
  const gate = checkCarMeetsTournamentGate(profile.selectedCarId, perf.powerRating, selectedId);
  const classStyle = CLASS_COLORS[car.carClass];

  return (
    <div className="safe-area-pad fixed inset-0 z-10 flex flex-col justify-between bg-[#060911]/92 p-3 sm:p-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-slate-100 transition hover:border-amber-400"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back</span>
          </button>
          <div>
            <h1 className="text-lg font-black uppercase italic tracking-wider text-white sm:text-xl">
              Career Championship Ladder
            </h1>
            <p className="text-[11px] font-semibold text-slate-300">
              8 Progressive Tournaments (24 Races) • Finish Top 3 Overall to Unlock Next Tier
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="carbon-panel flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-1.5 text-xs">
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
            <span className="font-bold text-white">{car.name}</span>
            <span className="font-telemetry font-black text-amber-400">{perf.powerRating} PR</span>
          </div>

          <div className="carbon-panel flex items-center gap-3 rounded-xl border border-amber-500/40 px-3.5 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Trophies
            </span>
            <span className="font-telemetry text-sm font-black text-amber-400">
              {profile.trophies.length}/8
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Left Scrollable 8-Cup Ladder, Right Cup Details + Standings */}
      <div className="my-3 grid min-h-0 flex-1 grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Left: Scrollable 8-Tournament Career Map */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1 lg:col-span-5">
          {TOURNAMENT_ORDER.map((tid) => {
            const cup = TOURNAMENT_CATALOG[tid];
            const unlocked = profile.unlockedTournaments.includes(tid);
            const won = profile.trophies.includes(tid);
            const inProgress =
              profile.activeTournament?.tournamentId === tid && !profile.activeTournament.completed;
            const isSel = selectedId === tid;
            const cupGate = checkCarMeetsTournamentGate(
              profile.selectedCarId,
              perf.powerRating,
              tid
            );

            return (
              <button
                key={tid}
                type="button"
                onClick={() => setSelectedId(tid)}
                className={`carbon-panel flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                  isSel
                    ? 'border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.22)]'
                    : unlocked
                      ? 'border-slate-700/80 hover:border-slate-500'
                      : 'border-slate-800/80 opacity-65 hover:opacity-90'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-black"
                    style={{
                      borderColor: unlocked ? cup.trophyColor : '#334155',
                      backgroundColor: unlocked ? `${cup.trophyColor}20` : '#0f172a',
                      color: unlocked ? cup.trophyColor : '#64748b',
                    }}
                  >
                    {won ? (
                      <Trophy className="h-5 w-5" />
                    ) : unlocked ? (
                      <span className="font-telemetry">#{cup.order}</span>
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-black uppercase italic text-white">
                        {cup.name}
                      </span>
                      {inProgress && (
                        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-cyan-300">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span className="text-cyan-300">{cup.classLabel}</span>
                      <span>•</span>
                      <span
                        className={`font-telemetry ${
                          cupGate.eligible ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {cup.minPowerRating}+ PR
                      </span>
                      <span>•</span>
                      <span className="font-telemetry text-amber-400">
                        ${cup.prizeCash.toLocaleString()} Cup
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {won ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Won
                    </span>
                  ) : unlocked ? (
                    <span className="text-[10px] font-black uppercase text-amber-300">Open</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-slate-500">Locked</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Selected Tournament Briefing, 3-Track Schedule & Live Standings */}
        <div className="carbon-panel flex min-h-0 flex-col justify-between gap-3 overflow-y-auto rounded-2xl border border-slate-700/90 p-4 sm:p-5 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-amber-400">
                  <span>Tier {selected.order} of 8</span>
                  <span>•</span>
                  <span>{selected.classLabel}</span>
                  <span>•</span>
                  <span className="font-telemetry">Min {selected.minPowerRating} PR</span>
                </div>
                <h2 className="mt-0.5 text-2xl font-black uppercase italic text-white">
                  {selected.name}
                </h2>
                <p className="mt-1 text-xs text-slate-300">{selected.description}</p>
              </div>

              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
                  Champion Prize
                </div>
                <div className="font-telemetry text-lg font-black text-amber-400">
                  ${selected.prizeCash.toLocaleString()}
                </div>
              </div>
            </div>

            {/* 3-Race Circuit Schedule */}
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>3-Race Championship Schedule</span>
                <span>Points: 1st: 10 • 2nd: 6 • 3rd: 4 • 4th: 2</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {selected.tracks.map((tid, idx) => {
                  const tSpec = TRACK_CATALOG[tid];
                  const isCurrent = activeHere && !activeHere.completed && activeHere.currentRaceIndex === idx;
                  const isDone =
                    activeHere && (activeHere.completed || activeHere.currentRaceIndex > idx);
                  return (
                    <div
                      key={`${tid}-${idx}`}
                      className={`rounded-xl border p-2.5 ${
                        isCurrent
                          ? 'border-cyan-400 bg-cyan-950/35'
                          : isDone
                            ? 'border-emerald-500/40 bg-emerald-950/20'
                            : 'border-slate-800 bg-slate-950/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-black uppercase">
                        <span className="text-slate-400">Race {idx + 1}</span>
                        {isDone ? (
                          <span className="text-emerald-400">Done</span>
                        ) : isCurrent ? (
                          <span className="text-cyan-300">Next</span>
                        ) : (
                          <span className="text-slate-500">{tSpec.laps} Laps</span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs font-black text-white">
                        {tSpec.name}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400">
                        {tSpec.weatherLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Championship Points Standings Table */}
            <div className="mt-3.5">
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                {activeHere ? 'Live Championship Standings' : 'Championship Entry Grid'}
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/85">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/90 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Driver</th>
                      <th className="px-3 py-2">Style</th>
                      <th className="px-3 py-2 text-right">Wins</th>
                      <th className="px-3 py-2 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {activeHere ? (
                      activeHere.standings.map((row, idx) => (
                        <tr
                          key={row.racerId}
                          className={row.isPlayer ? 'bg-amber-500/12 font-bold text-amber-200' : 'text-slate-200'}
                        >
                          <td className="font-telemetry px-3 py-1.5 font-black">{idx + 1}</td>
                          <td className="px-3 py-1.5">
                            <span
                              className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: row.bodyColor }}
                            />
                            {row.name}
                          </td>
                          <td className="px-3 py-1.5 text-[11px] text-slate-400">{row.styleLabel}</td>
                          <td className="font-telemetry px-3 py-1.5 text-right">{row.wins}</td>
                          <td className="font-telemetry px-3 py-1.5 text-right font-black text-cyan-300">
                            {row.points}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-400">
                          Start this tournament to begin tracking live points across all 3 circuits.
                          {hasTrophy ? ' Trophy already earned — replay anytime for bonus cash!' : ''}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom Gate Status & Launch CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
            {!isUnlocked ? (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Lock className="h-4 w-4 text-slate-500" />
                <span>Finish Top 3 in the previous Championship to unlock this tier.</span>
              </div>
            ) : !gate.eligible ? (
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/45 bg-rose-950/35 px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{gate.reason}</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenGarage}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-cyan-300"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Upgrade in Garage</span>
                </button>
              </div>
            ) : (
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                {activeHere && !activeHere.completed && (
                  <button
                    type="button"
                    onClick={() => onResetActiveTournament(selectedId)}
                    className="whitespace-nowrap rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-slate-500 hover:text-white"
                  >
                    Restart Cup
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onStartOrContinueTournament(selectedId)}
                  className="ml-auto flex items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-600 px-6 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(245,158,11,0.35)] transition hover:brightness-110"
                >
                  <Flag className="h-4 w-4 shrink-0" />
                  <span>
                    {activeHere && !activeHere.completed
                      ? `Continue Race ${activeHere.currentRaceIndex + 1}/3`
                      : `Start ${selected.name}`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
