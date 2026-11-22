import { Camera, Download, Eye, EyeOff, RotateCcw, X } from 'lucide-react';
import type { PhotoColorGrade, PhotoModeSettings } from '../game/types';

interface PhotoModeOverlayProps {
  settings: PhotoModeSettings;
  onUpdate: (patch: Partial<PhotoModeSettings>) => void;
  onResetCamera: () => void;
  onCaptureSnapshot: () => void;
  onExit: () => void;
  snapshotSavedFlash: boolean;
}

const GRADE_OPTIONS: { id: PhotoColorGrade; label: string; swatch: string }[] = [
  { id: 'natural', label: 'Natural', swatch: 'from-slate-300 to-cyan-300' },
  { id: 'cyberpunk', label: 'Neon Cyberpunk', swatch: 'from-cyan-400 to-fuchsia-500' },
  { id: 'golden', label: 'Golden Hour', swatch: 'from-amber-300 to-orange-500' },
  { id: 'noir', label: 'High-Contrast Noir', swatch: 'from-zinc-200 to-zinc-700' },
];

export function PhotoModeOverlay({
  settings,
  onUpdate,
  onResetCamera,
  onCaptureSnapshot,
  onExit,
  snapshotSavedFlash,
}: PhotoModeOverlayProps) {
  const fovDeg = Math.round(2 * Math.atan(24 / (2 * settings.focalLengthMm)) * (180 / Math.PI));

  if (settings.hideUi) {
    return (
      <div className="pointer-events-none fixed inset-0 z-40">
        <div className="pointer-events-auto fixed right-4 top-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ hideUi: false })}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-400/70 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/20"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Show HUD (H)</span>
          </button>
          <button
            type="button"
            onClick={onCaptureSnapshot}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-300"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Save PNG</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-4 select-none">
      {/* Top Bar: Mode Title + Action Buttons */}
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-rose-400 hover:text-white"
          >
            <X className="h-4 w-4 text-rose-400" />
            <span>Exit Photo Mode</span>
          </button>

          <div className="carbon-panel hidden items-center gap-2 rounded-xl border border-cyan-500/40 px-3.5 py-2 sm:flex">
            <Camera className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-black uppercase tracking-widest text-white">
              Cinematic Photo Mode
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onResetCamera}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-cyan-400 hover:text-white"
            title="Reset Orbit Camera"
          >
            <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
            <span>Reset Cam</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdate({ hideUi: true })}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-amber-400 hover:text-white"
            title="Hide HUD (H)"
          >
            <EyeOff className="h-3.5 w-3.5 text-amber-400" />
            <span>Hide HUD (H)</span>
          </button>

          <button
            type="button"
            onClick={onCaptureSnapshot}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg transition hover:brightness-110"
          >
            <Download className="h-4 w-4" />
            <span>{snapshotSavedFlash ? 'Saved PNG!' : 'Save Snapshot'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Camera & Post-Processing Dock — compact so center car stays unobstructed */}
      <div className="pointer-events-auto mx-auto w-full max-w-4xl">
        <div className="carbon-panel flex flex-col gap-3 rounded-2xl border border-slate-700/90 p-3.5 shadow-2xl">
          {/* Row 1: Focal Length, Camera Roll, Motion Blur sliders */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Focal Length */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                <span className="text-slate-300">Focal Length</span>
                <span className="font-telemetry text-cyan-300">
                  {settings.focalLengthMm}mm ({fovDeg}°)
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={85}
                step={1}
                value={settings.focalLengthMm}
                onChange={(e) => onUpdate({ focalLengthMm: Number(e.target.value) })}
                aria-label="Camera Focal Length"
                className="h-1.5 w-full cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Camera Roll Tilt */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                <span className="text-slate-300">Camera Roll</span>
                <span className="font-telemetry text-amber-300">
                  {settings.rollDeg > 0 ? `+${settings.rollDeg}°` : `${settings.rollDeg}°`}
                </span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                step={1}
                value={settings.rollDeg}
                onChange={(e) => onUpdate({ rollDeg: Number(e.target.value) })}
                aria-label="Camera Roll Tilt"
                className="h-1.5 w-full cursor-pointer accent-amber-400"
              />
            </div>

            {/* Motion Blur Post-Processing Filter */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                <span className="text-slate-300">Motion Blur FX</span>
                <span className="font-telemetry text-fuchsia-300">
                  {Math.round(settings.motionBlur * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(settings.motionBlur * 100)}
                onChange={(e) => onUpdate({ motionBlur: Number(e.target.value) / 100 })}
                aria-label="Motion Blur Filter"
                className="h-1.5 w-full cursor-pointer accent-fuchsia-400"
              />
            </div>
          </div>

          {/* Row 2: Color Grading Presets + Controls Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Color Grade:
              </span>
              {GRADE_OPTIONS.map((opt) => {
                const active = settings.colorGrade === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdate({ colorGrade: opt.id })}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/20 text-white'
                        : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full bg-gradient-to-tr ${opt.swatch}`}
                    />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Drag: Orbit • Shift+Drag / Right-Drag: Pan • Scroll: Zoom
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
