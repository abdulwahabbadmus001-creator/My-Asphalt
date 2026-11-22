import { Monitor, RotateCw, Smartphone } from 'lucide-react';

interface RotateOverlayProps {
  onBypass: () => void;
}

export function RotateOverlay({ onBypass }: RotateOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#060911] px-6 text-center text-white">
      <div className="carbon-panel flex max-w-sm flex-col items-center rounded-2xl border border-cyan-500/40 p-7 shadow-2xl">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-500/15 text-amber-400">
          <div className="relative flex items-center justify-center">
            <Smartphone className="h-9 w-9 -rotate-90" />
            <RotateCw className="absolute -right-2 -top-2 h-5 w-5 text-cyan-300" />
          </div>
        </div>
        <h2 className="text-xl font-black uppercase tracking-wider text-white">
          Rotate To Landscape
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          My Asphalt is engineered for widescreen landscape racing. Turn your device sideways for the
          full cockpit view, or launch in this window.
        </p>
        <div className="mt-5 flex w-full flex-col gap-2.5">
          <div className="rounded-lg border border-slate-700/80 bg-slate-900/90 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-400">
            Best Experience: Widescreen Landscape
          </div>
          <button
            type="button"
            onClick={onBypass}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/25"
          >
            <Monitor className="h-4 w-4 shrink-0" />
            Play in Window Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
