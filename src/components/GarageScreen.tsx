import { ArrowLeft, Check, Cpu, Flame, Globe2, Lock, Palette, Sparkles, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CALIPER_SWATCHES,
  CAR_CATALOG,
  CAR_ORDER,
  CAR_TOOL_ORDER,
  CAR_TOOLS,
  CLASS_COLORS,
  computeCarPerformance,
  DRIVER_CATALOG,
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
  PAINT_SWATCHES,
  RIM_SWATCHES,
  UNDERGLOW_SWATCHES,
  UPGRADE_LABELS,
} from '../game/catalog';
import type {
  CarClass,
  CarCustomization,
  CarId,
  CarToolId,
  PlayerProfile,
  UpgradeStatKey,
} from '../game/types';

interface GarageScreenProps {
  profile: PlayerProfile;
  previewCarId: CarId;
  onPreviewCar: (carId: CarId) => void;
  onBuyOrEquipCar: (carId: CarId) => void;
  onUpgradeStat: (carId: CarId, stat: UpgradeStatKey) => void;
  onBuyOrToggleTool: (carId: CarId, toolId: CarToolId) => void;
  onUpdateCustomization: (carId: CarId, patch: Partial<CarCustomization>) => void;
  onBack: () => void;
}

type GarageTab = 'upgrades' | 'tools' | 'styling';
type ClassFilter = 'ALL' | CarClass;

const CLASS_FILTER_OPTIONS: ClassFilter[] = ['ALL', 'D', 'C', 'B', 'S', 'HYPER'];

export function GarageScreen({
  profile,
  previewCarId,
  onPreviewCar,
  onBuyOrEquipCar,
  onUpgradeStat,
  onBuyOrToggleTool,
  onUpdateCustomization,
  onBack,
}: GarageScreenProps) {
  const [tab, setTab] = useState<GarageTab>('upgrades');
  const [classFilter, setClassFilter] = useState<ClassFilter>('ALL');

  const filteredCarIds = useMemo(
    () =>
      classFilter === 'ALL'
        ? CAR_ORDER
        : CAR_ORDER.filter((cid) => CAR_CATALOG[cid].carClass === classFilter),
    [classFilter]
  );

  const classCounts = useMemo(() => {
    const counts: Record<ClassFilter, number> = {
      ALL: CAR_ORDER.length,
      D: 0,
      C: 0,
      B: 0,
      S: 0,
      HYPER: 0,
    };
    for (const cid of CAR_ORDER) {
      counts[CAR_CATALOG[cid].carClass] += 1;
    }
    return counts;
  }, []);

  const spec = CAR_CATALOG[previewCarId] ?? CAR_CATALOG.civic_gt;
  const classStyle = CLASS_COLORS[spec.carClass];
  const isUnlocked = profile.unlockedCars.includes(previewCarId);
  const isEquipped = profile.selectedCarId === previewCarId;
  const upgrades = profile.upgrades[previewCarId] ?? {
    topSpeed: 1,
    acceleration: 1,
    handling: 1,
    nitro: 1,
  };
  const ownedTools = profile.ownedTools[previewCarId] ?? [];
  const equippedTools = profile.equippedTools[previewCarId] ?? [];
  const custom = profile.customizations[previewCarId] ?? spec.defaultCustomization;
  const driver = DRIVER_CATALOG[profile.selectedDriverId] ?? DRIVER_CATALOG.rookie;
  const perf = computeCarPerformance(previewCarId, upgrades, equippedTools, driver.perks);

  const handleSelectFilter = (nextFilter: ClassFilter) => {
    setClassFilter(nextFilter);
    if (nextFilter !== 'ALL') {
      const matching = CAR_ORDER.filter((cid) => CAR_CATALOG[cid].carClass === nextFilter);
      if (matching.length > 0 && !matching.includes(previewCarId)) {
        onPreviewCar(matching[0]);
      }
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3.5 sm:p-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-slate-100 transition hover:border-cyan-400"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back</span>
          </button>
          <div>
            <h1 className="text-lg font-black uppercase italic tracking-wider text-white sm:text-xl">
              Garage & Car Tools
            </h1>
            <p className="text-[11px] font-semibold text-slate-300">
              Drag 3D showroom to inspect • 18 Cars across Classes D / C / B / S / HYPER
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

      {/* Middle: Left Carbon Inspector Panel (Right stays clear for 3D Car) */}
      <div className="my-2 flex min-h-0 flex-1 items-center">
        <div className="pointer-events-auto carbon-panel flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-slate-700/90 shadow-2xl">
          {/* Selected Car Header + Class & PR */}
          <div className="border-b border-slate-800 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase"
                    style={{
                      backgroundColor: classStyle.bg,
                      color: classStyle.text,
                      border: `1px solid ${classStyle.border}`,
                    }}
                  >
                    {spec.carClass === 'HYPER' ? 'HYPER' : `Class ${spec.carClass}`}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-slate-700/80 bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-200">
                    <Globe2 className="h-3 w-3 text-cyan-400" />
                    {spec.brandOrigin}
                  </span>
                </div>
                <h2 className="mt-1 text-lg font-black uppercase italic leading-tight text-white">
                  {spec.name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="font-telemetry inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                    <Flame className="h-3 w-3 text-amber-400" />
                    {spec.engineLabel}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {spec.category}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="font-telemetry text-lg font-black leading-none text-amber-400">
                  {perf.powerRating} PR
                </div>
                <div className="font-telemetry mt-0.5 text-[11px] font-bold text-cyan-300">
                  {Math.round(perf.maxSpeedKmh)} KM/H
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-300">{spec.tagline}</p>

            {/* Primary Unlock / Equip CTA */}
            <div className="mt-2.5 flex items-center gap-2">
              {isEquipped ? (
                <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/15 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-300">
                  <Check className="h-4 w-4" />
                  <span>Equipped Ride</span>
                </div>
              ) : isUnlocked ? (
                <button
                  type="button"
                  onClick={() => onBuyOrEquipCar(previewCarId)}
                  className="flex-1 whitespace-nowrap rounded-lg bg-cyan-400 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-cyan-300"
                >
                  Select Car
                </button>
              ) : (
                <button
                  type="button"
                  disabled={profile.cash < spec.price}
                  onClick={() => onBuyOrEquipCar(previewCarId)}
                  className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg py-1.5 text-xs font-black uppercase tracking-wider transition ${
                    profile.cash >= spec.price
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      : 'cursor-not-allowed bg-slate-800 text-slate-500'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Unlock — ${spec.price.toLocaleString()}</span>
                </button>
              )}
            </div>
          </div>

          {/* 3 Tabs: Tuning / Car Tools / Styling */}
          <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/80 text-[11px] font-black uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setTab('upgrades')}
              className={`flex items-center justify-center gap-1.5 py-2.5 transition ${
                tab === 'upgrades'
                  ? 'border-b-2 border-amber-400 text-amber-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Tuning</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('tools')}
              className={`flex items-center justify-center gap-1.5 py-2.5 transition ${
                tab === 'tools'
                  ? 'border-b-2 border-fuchsia-400 text-fuchsia-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Car Tools ({equippedTools.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('styling')}
              className={`flex items-center justify-center gap-1.5 py-2.5 transition ${
                tab === 'styling'
                  ? 'border-b-2 border-cyan-400 text-cyan-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              <span>Styling</span>
            </button>
          </div>

          {/* Tab Body */}
          <div className="flex-1 overflow-y-auto p-3.5">
            {tab === 'upgrades' && (
              <div className="space-y-3">
                {UPGRADE_LABELS.map(({ key, label }) => {
                  const lvl = upgrades[key];
                  const val = perf.displayStats[key];
                  const cost = getUpgradeCost(previewCarId, lvl);
                  const maxed = lvl >= MAX_UPGRADE_LEVEL;
                  const canAfford = isUnlocked && !maxed && profile.cash >= cost;

                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-slate-800 bg-slate-950/75 p-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold uppercase tracking-wider text-slate-200">
                          {label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-telemetry text-[11px] font-bold text-slate-400">
                            LV {lvl}/{MAX_UPGRADE_LEVEL}
                          </span>
                          <span className="font-telemetry font-black text-cyan-300">{val}</span>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all"
                            style={{ width: `${Math.min(100, val)}%` }}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onUpgradeStat(previewCarId, key)}
                          className={`font-telemetry min-w-[76px] whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-black uppercase transition ${
                            maxed
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : canAfford
                                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                                : 'cursor-not-allowed bg-slate-800 text-slate-500'
                          }`}
                        >
                          {maxed ? 'MAX' : `$${cost.toLocaleString()}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'tools' && (
              <div className="space-y-2.5">
                {CAR_TOOL_ORDER.map((toolId) => {
                  const tool = CAR_TOOLS[toolId];
                  const isOwned = ownedTools.includes(toolId);
                  const isToolEquipped = equippedTools.includes(toolId);
                  const canAfford = isUnlocked && !isOwned && profile.cash >= tool.price;

                  return (
                    <div
                      key={toolId}
                      className={`rounded-xl border p-2.5 transition ${
                        isToolEquipped
                          ? 'border-fuchsia-400/70 bg-fuchsia-950/30'
                          : 'border-slate-800 bg-slate-950/75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black uppercase tracking-wide text-white">
                              {tool.name}
                            </span>
                            <span className="font-telemetry rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                              +{tool.powerRatingBonus} PR
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
                            {tool.effectSummary}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={!isUnlocked || (!isOwned && !canAfford)}
                          onClick={() => onBuyOrToggleTool(previewCarId, toolId)}
                          className={`font-telemetry shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase transition ${
                            isToolEquipped
                              ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400'
                              : isOwned
                                ? 'border border-cyan-400/60 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/35'
                                : canAfford
                                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                                  : 'cursor-not-allowed bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isToolEquipped
                            ? 'Equipped'
                            : isOwned
                              ? 'Equip'
                              : `$${tool.price.toLocaleString()}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'styling' && (
              <div className="space-y-3.5">
                {/* Paint Finish Toggle */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    <span>Paint Finish</span>
                    <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['metallic', 'matte'] as const).map((finish) => (
                      <button
                        key={finish}
                        type="button"
                        onClick={() => onUpdateCustomization(previewCarId, { finish })}
                        className={`rounded-lg border py-1.5 text-xs font-black uppercase tracking-wider transition ${
                          custom.finish === finish
                            ? 'border-cyan-400 bg-cyan-400/20 text-cyan-100'
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {finish}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Body Paint */}
                <div>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Body Paint
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PAINT_SWATCHES.map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        title={sw.name}
                        onClick={() => onUpdateCustomization(previewCarId, { bodyColor: sw.hex })}
                        className={`h-7 w-7 rounded-md border-2 transition ${
                          custom.bodyColor === sw.hex
                            ? 'scale-110 border-white'
                            : 'border-slate-700 hover:scale-105'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* Rim Alloy */}
                <div>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Rim Finish
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {RIM_SWATCHES.map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        title={sw.name}
                        onClick={() => onUpdateCustomization(previewCarId, { rimColor: sw.hex })}
                        className={`h-7 w-7 rounded-full border-2 transition ${
                          custom.rimColor === sw.hex
                            ? 'scale-110 border-amber-400'
                            : 'border-slate-700 hover:scale-105'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* Brake Caliper Accent */}
                <div>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Brake Calipers
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CALIPER_SWATCHES.map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        title={sw.name}
                        onClick={() =>
                          onUpdateCustomization(previewCarId, { caliperColor: sw.hex })
                        }
                        className={`h-7 w-7 rounded-md border-2 transition ${
                          custom.caliperColor === sw.hex
                            ? 'scale-110 border-white'
                            : 'border-slate-700 hover:scale-105'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* Neon Underglow */}
                <div>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Neon Underglow
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {UNDERGLOW_SWATCHES.map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        title={sw.name}
                        onClick={() =>
                          onUpdateCustomization(previewCarId, { underglowColor: sw.hex })
                        }
                        className={`flex h-7 items-center justify-center rounded-md border-2 px-2 text-[10px] font-black uppercase transition ${
                          custom.underglowColor === sw.hex
                            ? 'scale-105 border-white'
                            : 'border-slate-700 hover:border-slate-400'
                        }`}
                        style={{
                          backgroundColor: sw.hex === 'none' ? '#0f172a' : sw.hex,
                          color: sw.hex === '#f8fafc' ? '#0f172a' : '#ffffff',
                        }}
                      >
                        {sw.hex === 'none' ? 'OFF' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Class Filter Bar + Scrollable 18-Car Roster Strip */}
      <div className="pointer-events-auto flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="carbon-panel inline-flex items-center gap-1 rounded-xl border border-slate-700/80 p-1">
            {CLASS_FILTER_OPTIONS.map((cls) => {
              const active = classFilter === cls;
              const style = cls === 'ALL' ? null : CLASS_COLORS[cls];
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => handleSelectFilter(cls)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wider transition ${
                    active
                      ? 'bg-cyan-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  style={
                    active && style
                      ? {
                          backgroundColor: style.border,
                          color: '#020617',
                        }
                      : undefined
                  }
                >
                  <span>{cls === 'ALL' ? 'ALL' : cls === 'HYPER' ? 'HYPER' : `CLASS ${cls}`}</span>
                  <span className="font-telemetry text-[10px] opacity-80">
                    ({classCounts[cls]})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="font-telemetry text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Owned {profile.unlockedCars.length}/{CAR_ORDER.length}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {filteredCarIds.map((cid) => {
            const item = CAR_CATALOG[cid];
            const cStyle = CLASS_COLORS[item.carClass];
            const owned = profile.unlockedCars.includes(cid);
            const selected = cid === previewCarId;
            const equipped = cid === profile.selectedCarId;
            const itemPerf = computeCarPerformance(
              cid,
              profile.upgrades[cid],
              profile.equippedTools[cid] ?? [],
              driver.perks
            );

            return (
              <button
                key={cid}
                type="button"
                onClick={() => onPreviewCar(cid)}
                className={`carbon-panel flex w-[166px] shrink-0 flex-col items-start rounded-xl border px-2.5 py-2 text-left transition ${
                  selected
                    ? 'border-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.3)]'
                    : 'border-slate-700/80 hover:border-slate-500'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase"
                    style={{
                      backgroundColor: cStyle.bg,
                      color: cStyle.text,
                      border: `1px solid ${cStyle.border}`,
                    }}
                  >
                    {item.carClass}
                  </span>
                  <span className="font-telemetry text-[10px] font-black text-amber-400">
                    {itemPerf.powerRating} PR
                  </span>
                </div>
                <div className="mt-1 w-full truncate text-xs font-black text-white">
                  {item.name}
                </div>
                <div className="w-full truncate text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {item.engineLabel}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider">
                  {equipped ? (
                    <span className="text-emerald-400">Equipped</span>
                  ) : owned ? (
                    <span className="text-cyan-300">Owned</span>
                  ) : (
                    <span className="font-telemetry text-amber-300">
                      ${item.price.toLocaleString()}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
