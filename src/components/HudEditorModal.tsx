import { RotateCcw, Sliders, X } from 'lucide-react';
import type { HudLayoutConfig } from '../game/types';

interface HudEditorModalProps {
  layout: HudLayoutConfig;
  onChange: (next: HudLayoutConfig) => void;
  onClose: () => void;
}

const DEFAULT_LAYOUT: HudLayoutConfig = {
  scale: 1.0,
  opacity: 0.85,
  joystickOffset: { x: 0, y: 0 },
  pedalsOffset: { x: 0, y: 0 },
};

export function HudEditorModal({ layout, onChange, onClose }: HudEditorModalProps) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="carbon-panel w-full max-w-md rounded-2xl border border-cyan-400/50 p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-black uppercase italic tracking-wider">
              Customize Touch HUD
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-cyan-400"
            aria-label="Close HUD Editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div>
            <div className="mb-1 flex justify-between font-bold uppercase text-slate-300">
              <span>Button Scale</span>
              <span className="font-telemetry text-cyan-300">{layout.scale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.4"
              step="0.05"
              value={layout.scale}
              onChange={(e) => onChange({ ...layout, scale: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between font-bold uppercase text-slate-300">
              <span>Control Opacity</span>
              <span className="font-telemetry text-cyan-300">{Math.round(layout.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.35"
              max="1.0"
              step="0.05"
              value={layout.opacity}
              onChange={(e) => onChange({ ...layout, opacity: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 font-bold uppercase text-slate-300">Joystick Y Offset</div>
              <input
                type="range"
                min="-80"
                max="40"
                step="5"
                value={layout.joystickOffset.y}
                onChange={(e) =>
                  onChange({
                    ...layout,
                    joystickOffset: { ...layout.joystickOffset, y: Number(e.target.value) },
                  })
                }
                className="w-full accent-amber-400"
              />
            </div>
            <div>
              <div className="mb-1 font-bold uppercase text-slate-300">Pedals Y Offset</div>
              <input
                type="range"
                min="-80"
                max="40"
                step="5"
                value={layout.pedalsOffset.y}
                onChange={(e) =>
                  onChange({
                    ...layout,
                    pedalsOffset: { ...layout.pedalsOffset, y: Number(e.target.value) },
                  })
                }
                className="w-full accent-amber-400"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_LAYOUT)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 py-2.5 text-xs font-black uppercase text-slate-200 hover:border-amber-400"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Default</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-cyan-400 py-2.5 text-xs font-black uppercase text-slate-950 hover:bg-cyan-300"
          >
            Save Layout
          </button>
        </div>
      </div>
    </div>
  );
}
