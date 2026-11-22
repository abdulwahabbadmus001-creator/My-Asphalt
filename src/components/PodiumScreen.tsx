import { ArrowRight, Camera, Flag, Home, RotateCcw, Sparkles, Trophy, Wrench } from 'lucide-react';
import { TOURNAMENT_CATALOG, TRACK_CATALOG } from '../game/catalog';
import type { RaceResultSummary } from '../game/types';

interface PodiumScreenProps {
  summary: RaceResultSummary;
  onNextRace: () => void;
  onRetryRace: () => void;
  onOpenPhotoMode: () => void;
  onOpenGarage: () => void;
  onOpenCareer: () => void;
  onReturnTitle: () => void;
}

function formatTime(sec: number | null): string {
  if (sec === null) return '--:--.--';
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  const secs = Math.floor(rem);
  const hundredths = Math.floor((rem - secs) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

export function PodiumScreen({
  summary,
  onNextRace,
  onRetryRace,
  onOpenPhotoMode,
  onOpenGarage,
  onOpenCareer,
  onReturnTitle,
}: PodiumScreenProps) {
  const track = TRACK_CATALOG[summary.trackId];
  const cup = summary.tournamentId ? TOURNAMENT_CATALOG[summary.tournamentId] : null;
  const unlockedCup = summary.unlockedTournamentId
    ? TOURNAMENT_CATALOG[summary.unlockedTournamentId]
    : null;
  const isPodium = summary.playerPlace <= 3;
  const st = summary.stuntStats;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between overflow-y-auto bg-[#060911]/92 p-4 sm:p-5">
      {/* Top Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-300">
            {cup
              ? `${cup.name} • Race ${(summary.raceIndex ?? 0) + 1} of 3`
              : summary.mode === 'splitscreen'
                ? `2P Split-Screen • ${track.name}`
                : summary.mode === 'p2p'
                  ? `Local P2P Race • ${track.name}`
                  : `Quick Race • ${track.name}`}
          </div>
          <h1 className="mt-0.5 text-2xl font-black uppercase italic text-white sm:text-3xl">
            {summary.playerPlace === 1
              ? '1st Place Victory!'
              : isPodium
                ? `Podium Finish — P${summary.playerPlace}`
                : `Race Complete — P${summary.playerPlace}`}
          </h1>
        </div>

        <div className="carbon-panel flex items-center gap-4 rounded-xl border border-amber-400/60 px-4 py-2.5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Total Payout
            </div>
            <div className="font-telemetry text-2xl font-black text-amber-400">
              +${summary.totalCashEarned.toLocaleString()}
            </div>
          </div>
          {st.stuntMultiplier > 1 && (
            <div className="rounded-lg border border-fuchsia-400/60 bg-fuchsia-950/60 px-2.5 py-1 text-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">
                Stunt Mult
              </div>
              <div className="font-telemetry text-sm font-black text-white">
                x{st.stuntMultiplier.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tournament Unlock / Trophy Callout */}
      {(summary.wonTournamentTrophy || unlockedCup) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/70 bg-amber-500/15 px-4 py-2.5">
          <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-wider text-amber-200">
            <Trophy className="h-5 w-5 text-amber-400" />
            <span>
              {summary.wonTournamentTrophy
                ? `Champion Trophy Earned: ${cup?.name}!`
                : `Tournament Podium Reached!`}
              {unlockedCup ? ` — Unlocked Next Tier: ${unlockedCup.name} (${unlockedCup.classLabel})` : ''}
            </span>
          </div>
          {summary.tournamentBonusCash > 0 && (
            <span className="font-telemetry text-sm font-black text-amber-300">
              +${summary.tournamentBonusCash.toLocaleString()} Cup Bonus
            </span>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="my-3 grid min-h-0 flex-1 grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Left: Race Classification */}
        <div className="carbon-panel flex flex-col overflow-hidden rounded-2xl border border-slate-700/90 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
            <span className="text-xs font-black uppercase tracking-widest text-slate-300">
              Official Race Classification
            </span>
            {summary.wonFastestLapBonus && (
              <span className="rounded bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-fuchsia-300">
                Fastest Lap +${summary.fastestLapCash}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/90 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Driver</th>
                  <th className="px-3 py-2 text-right">Time</th>
                  <th className="px-3 py-2 text-right">Best Lap</th>
                  {summary.mode === 'tournament' && <th className="px-3 py-2 text-right">Pts</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {summary.entries.map((entry) => (
                  <tr
                    key={entry.racerId}
                    className={
                      entry.isPlayer
                        ? 'bg-amber-500/14 font-bold text-amber-200'
                        : 'text-slate-200'
                    }
                  >
                    <td className="font-telemetry px-3 py-2 font-black">{entry.place}</td>
                    <td className="px-3 py-2">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: entry.bodyColor }}
                      />
                      <span>{entry.name}</span>
                      <span className="ml-1.5 text-[10px] text-slate-400">({entry.styleLabel})</span>
                    </td>
                    <td className="font-telemetry px-3 py-2 text-right">
                      {formatTime(entry.finishTime)}
                    </td>
                    <td className="font-telemetry px-3 py-2 text-right text-cyan-300">
                      {formatTime(entry.bestLapTime)}
                    </td>
                    {summary.mode === 'tournament' && (
                      <td className="font-telemetry px-3 py-2 text-right font-black text-amber-300">
                        +{entry.pointsAwarded}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Stunt & Cash Breakdown + Live Cup Standings */}
        <div className="flex flex-col gap-3 lg:col-span-5">
          {/* Payout & Stunt Breakdown */}
          <div className="carbon-panel rounded-2xl border border-slate-700/90 p-3.5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-amber-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Race &amp; Stunt Payout
              </span>
              <span className="font-telemetry text-fuchsia-300">
                Stunt x{st.stuntMultiplier.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-200">
                <span>Finish Position (P{summary.playerPlace})</span>
                <span className="font-telemetry font-bold text-white">
                  +${summary.positionCash.toLocaleString()}
                </span>
              </div>
              {summary.fastestLapCash > 0 && (
                <div className="flex justify-between text-fuchsia-300">
                  <span>Fastest Lap Bonus</span>
                  <span className="font-telemetry font-bold">+${summary.fastestLapCash}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300">
                <span>
                  Stunts ({st.takedowns} Takedowns • {st.nearMisses} Near Misses •{' '}
                  {st.airTimeSeconds.toFixed(1)}s Air)
                </span>
                <span className="font-telemetry font-bold text-cyan-300">
                  +${st.totalStuntCash.toLocaleString()}
                </span>
              </div>
              {summary.driverCashBonus > 0 && (
                <div className="flex justify-between text-emerald-300">
                  <span>Driver Passive Cash Bonus</span>
                  <span className="font-telemetry font-bold">+${summary.driverCashBonus}</span>
                </div>
              )}
              {summary.tournamentBonusCash > 0 && (
                <div className="flex justify-between text-amber-300">
                  <span>Championship Podium Bonus</span>
                  <span className="font-telemetry font-bold">
                    +${summary.tournamentBonusCash.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Updated Championship Standings if in Career Mode */}
          {summary.updatedStandings && (
            <div className="carbon-panel flex-1 overflow-hidden rounded-2xl border border-slate-700/90">
              <div className="border-b border-slate-800 px-3.5 py-2 text-[11px] font-black uppercase tracking-widest text-slate-300">
                Updated Championship Standings
              </div>
              <div className="divide-y divide-slate-800/80 text-xs">
                {summary.updatedStandings.slice(0, 6).map((row, idx) => (
                  <div
                    key={row.racerId}
                    className={`flex items-center justify-between px-3.5 py-1.5 ${
                      row.isPlayer ? 'bg-amber-500/14 font-bold text-amber-200' : 'text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-telemetry w-4 font-black text-slate-400">
                        {idx + 1}
                      </span>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: row.bodyColor }}
                      />
                      <span className="truncate">{row.name}</span>
                    </div>
                    <span className="font-telemetry font-black text-cyan-300">{row.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-800 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReturnTitle}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-slate-500"
          >
            <Home className="h-4 w-4" />
            <span>Title</span>
          </button>
          <button
            type="button"
            onClick={onOpenGarage}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-cyan-200 transition hover:border-cyan-400"
          >
            <Wrench className="h-4 w-4" />
            <span>Garage</span>
          </button>
          <button
            type="button"
            onClick={onOpenCareer}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-amber-200 transition hover:border-amber-400"
          >
            <Trophy className="h-4 w-4" />
            <span>Career</span>
          </button>
          <button
            type="button"
            onClick={onOpenPhotoMode}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-cyan-400/70 bg-cyan-500/15 px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/25"
          >
            <Camera className="h-4 w-4" />
            <span>Photo Mode</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRetryRace}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:border-cyan-400"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Retry</span>
          </button>

          {summary.mode === 'tournament' && !summary.isTournamentComplete ? (
            <button
              type="button"
              onClick={onNextRace}
              className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-600 px-6 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-lg transition hover:brightness-110"
            >
              <span>Next Race</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={summary.mode === 'tournament' ? onOpenCareer : onRetryRace}
              className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-600 px-6 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-lg transition hover:brightness-110"
            >
              <Flag className="h-4 w-4" />
              <span>{summary.mode === 'tournament' ? 'Career Ladder' : 'Race Again'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
