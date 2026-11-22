import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Flag,
  Link2,
  Monitor,
  QrCode,
  Radio,
  Users,
  Wifi,
} from 'lucide-react';
import { TRACK_CATALOG, TRACK_ORDER } from '../game/catalog';
import {
  type OfflineP2PManager,
  type P2PConnectionStatus,
  renderQrToCanvas,
} from '../game/p2p';
import type { PlayerProfile, TrackId } from '../game/types';

interface MultiplayerScreenProps {
  profile: PlayerProfile;
  p2pManager: OfflineP2PManager;
  p2pStatus: P2PConnectionStatus;
  p2pDetail: string;
  onStartP2PRaceAsHost: (trackId: TrackId) => void;
  onStartSplitScreen: (trackId: TrackId) => void;
  onBack: () => void;
}

export function MultiplayerScreen({
  profile,
  p2pManager,
  p2pStatus,
  p2pDetail,
  onStartP2PRaceAsHost,
  onStartSplitScreen,
  onBack,
}: MultiplayerScreenProps) {
  const [role, setRole] = useState<'host' | 'guest'>('host');
  const [selectedTrack, setSelectedTrack] = useState<TrackId>('night');
  const [splitTrack, setSplitTrack] = useState<TrackId>('night');

  // Host state
  const [offerCode, setOfferCode] = useState('');
  const [answerInput, setAnswerInput] = useState('');

  // Guest state
  const [offerInput, setOfferInput] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [guestHostLabel, setGuestHostLabel] = useState('');

  const [copiedFlag, setCopiedFlag] = useState(false);
  const [cameraScanNote, setCameraScanNote] = useState('');
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeQrCode = role === 'host' ? offerCode : answerCode;

  useEffect(() => {
    if (!activeQrCode || !qrCanvasRef.current) return;
    renderQrToCanvas(qrCanvasRef.current, activeQrCode);
  }, [activeQrCode]);

  const handleGenerateOffer = async () => {
    const custom = profile.customizations[profile.selectedCarId];
    const code = await p2pManager.createHostOffer(
      profile.playerName,
      profile.selectedCarId,
      custom.bodyColor,
      selectedTrack
    );
    setOfferCode(code);
  };

  const handleConnectAnswer = async () => {
    if (!answerInput.trim()) return;
    await p2pManager.acceptGuestAnswer(answerInput.trim());
  };

  const handleAcceptOffer = async () => {
    if (!offerInput.trim()) return;
    const custom = profile.customizations[profile.selectedCarId];
    const res = await p2pManager.acceptHostOfferAndCreateAnswer(
      offerInput.trim(),
      profile.playerName,
      profile.selectedCarId,
      custom.bodyColor
    );
    if (res) {
      setAnswerCode(res.answerCode);
      setGuestHostLabel(`${res.hostInfo.name} (${TRACK_CATALOG[res.trackId].name})`);
    }
  };

  const handleCopyCode = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFlag(true);
      window.setTimeout(() => setCopiedFlag(false), 1800);
    } catch {
      // Fallback: user can select text directly
    }
  };

  const handleCameraQrScan = async () => {
    setCameraScanNote('');
    const hasBarcodeDetector =
      typeof window !== 'undefined' && 'BarcodeDetector' in window;
    if (!hasBarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setCameraScanNote(
        'Camera QR scanning requires a supported mobile browser. Paste the MA1:... code below directly!'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const DetectorCtor = (
        window as unknown as {
          BarcodeDetector: new (opts: { formats: string[] }) => {
            detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
          };
        }
      ).BarcodeDetector;
      const detector = new DetectorCtor({ formats: ['qr_code'] });

      let found = '';
      for (let attempt = 0; attempt < 15; attempt++) {
        const codes = await detector.detect(video);
        if (codes.length > 0 && codes[0].rawValue.startsWith('MA1:')) {
          found = codes[0].rawValue;
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      stream.getTracks().forEach((t) => t.stop());

      if (found) {
        if (role === 'host') setAnswerInput(found);
        else setOfferInput(found);
        setCameraScanNote('Session code captured from QR!');
      } else {
        setCameraScanNote('No QR detected within scan window — paste the MA1:... code instead.');
      }
    } catch {
      setCameraScanNote('Camera permission unavailable — paste the MA1:... session code below.');
    }
  };

  const remoteInfo = p2pManager.getRemoteInfo();

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-[#060911]/92 p-4 sm:p-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="carbon-panel flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-cyan-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              <Wifi className="h-3.5 w-3.5" />
              <span>100% Offline Serverless Multiplayer</span>
            </div>
            <h1 className="text-xl font-black uppercase italic text-white sm:text-2xl">
              Local P2P &amp; Split-Screen Lobby
            </h1>
          </div>
        </div>

        <div className="carbon-panel flex items-center gap-2 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-bold">
          <Radio
            className={`h-4 w-4 ${
              p2pStatus === 'connected'
                ? 'text-emerald-400'
                : p2pStatus === 'error'
                  ? 'text-rose-400'
                  : 'text-cyan-400'
            }`}
          />
          <span className="uppercase tracking-wider text-slate-300">
            Link: <strong className="text-white">{p2pStatus.replace('_', ' ')}</strong>
          </span>
        </div>
      </div>

      {/* Main Grid: Left Serverless WebRTC P2P | Right 2-Player Local Split-Screen */}
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-12">
        {/* Left: Serverless WebRTC P2P (Wi-Fi / Hotspot) */}
        <div className="carbon-panel flex flex-col gap-3 rounded-2xl border border-cyan-500/40 p-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black uppercase italic text-white">
                <Link2 className="h-4 w-4 text-cyan-400" />
                <span>Serverless WebRTC Local P2P (Wi-Fi / Hotspot)</span>
              </h2>
              <p className="text-xs text-slate-400">
                Race two devices on the same Wi-Fi or hotspot at 60Hz with zero internet server.
              </p>
            </div>

            {/* Role Toggle */}
            <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setRole('host')}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
                  role === 'host'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                1. Host Race
              </button>
              <button
                type="button"
                onClick={() => setRole('guest')}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
                  role === 'guest'
                    ? 'bg-fuchsia-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                2. Join Race
              </button>
            </div>
          </div>

          {p2pDetail && (
            <div className="rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-1.5 text-xs font-semibold text-cyan-200">
              {p2pDetail}
              {remoteInfo && ` • Peer: ${remoteInfo.name}`}
            </div>
          )}

          {role === 'host' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              {/* Host Controls */}
              <div className="flex flex-col gap-3 md:col-span-7">
                <div>
                  <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Select P2P Circuit
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TRACK_ORDER.map((tid) => (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => setSelectedTrack(tid)}
                        className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                          selectedTrack === tid
                            ? 'border-cyan-400 bg-cyan-500/20 text-white'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
                        }`}
                      >
                        {TRACK_CATALOG[tid].name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateOffer}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-cyan-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-cyan-300"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Step 1: Generate Offer Code &amp; QR</span>
                  </button>

                  {offerCode && (
                    <button
                      type="button"
                      onClick={() => handleCopyCode(offerCode)}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:border-cyan-400"
                    >
                      {copiedFlag ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedFlag ? 'Copied!' : 'Copy Offer'}</span>
                    </button>
                  )}
                </div>

                {offerCode && (
                  <div>
                    <label
                      htmlFor="host-offer-code"
                      className="block text-[10px] font-black uppercase tracking-widest text-slate-400"
                    >
                      Host Offer Code (Send to Guest)
                    </label>
                    <textarea
                      id="host-offer-code"
                      readOnly
                      rows={2}
                      value={offerCode}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-[10px] text-cyan-200"
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="host-answer-input"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                    >
                      Step 2: Paste Guest Answer Code
                    </label>
                    <button
                      type="button"
                      onClick={handleCameraQrScan}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-cyan-300 hover:text-cyan-200"
                    >
                      <Camera className="h-3 w-3" />
                      <span>Scan QR</span>
                    </button>
                  </div>
                  <textarea
                    id="host-answer-input"
                    rows={2}
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder="Paste Guest MA1:... Answer Code here"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-[10px] text-white outline-none focus:border-cyan-400"
                  />
                  {cameraScanNote && (
                    <div className="mt-1 text-[11px] text-amber-300">{cameraScanNote}</div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConnectAnswer}
                    disabled={!offerCode || !answerInput.trim()}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-400/70 bg-emerald-500/20 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/35 disabled:opacity-45"
                  >
                    <Link2 className="h-4 w-4" />
                    <span>Connect Peer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onStartP2PRaceAsHost(selectedTrack)}
                    disabled={p2pStatus !== 'connected'}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
                  >
                    <Flag className="h-4 w-4" />
                    <span>Launch 60Hz P2P Race</span>
                  </button>
                </div>
              </div>

              {/* Host Procedural QR Canvas */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950/90 p-3 md:col-span-5">
                {offerCode ? (
                  <>
                    <canvas
                      ref={qrCanvasRef}
                      width={184}
                      height={184}
                      className="rounded-lg border-4 border-white shadow-lg"
                      aria-label="Procedural Offline WebRTC Offer QR Code"
                    />
                    <div className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                      Offline Offer QR • {offerCode.length} chars
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-slate-500">
                    <QrCode className="h-10 w-10 text-slate-700" />
                    <span>Generate Offer Code to render local QR matrix</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              {/* Guest Controls */}
              <div className="flex flex-col gap-3 md:col-span-7">
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="guest-offer-input"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                    >
                      Step 1: Paste Host Offer Code
                    </label>
                    <button
                      type="button"
                      onClick={handleCameraQrScan}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-fuchsia-300 hover:text-fuchsia-200"
                    >
                      <Camera className="h-3 w-3" />
                      <span>Scan QR</span>
                    </button>
                  </div>
                  <textarea
                    id="guest-offer-input"
                    rows={2}
                    value={offerInput}
                    onChange={(e) => setOfferInput(e.target.value)}
                    placeholder="Paste Host MA1:... Offer Code here"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-[10px] text-white outline-none focus:border-fuchsia-400"
                  />
                  {cameraScanNote && (
                    <div className="mt-1 text-[11px] text-amber-300">{cameraScanNote}</div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptOffer}
                    disabled={!offerInput.trim()}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-fuchsia-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-fuchsia-300 disabled:opacity-45"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Step 2: Generate Answer Code &amp; QR</span>
                  </button>

                  {answerCode && (
                    <button
                      type="button"
                      onClick={() => handleCopyCode(answerCode)}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:border-fuchsia-400"
                    >
                      {copiedFlag ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedFlag ? 'Copied!' : 'Copy Answer'}</span>
                    </button>
                  )}
                </div>

                {answerCode && (
                  <div>
                    <label
                      htmlFor="guest-answer-code"
                      className="block text-[10px] font-black uppercase tracking-widest text-slate-400"
                    >
                      Guest Answer Code (Send Back to {guestHostLabel || 'Host'})
                    </label>
                    <textarea
                      id="guest-answer-code"
                      readOnly
                      rows={2}
                      value={answerCode}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-[10px] text-fuchsia-200"
                    />
                  </div>
                )}

                <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-950/30 px-3 py-2 text-xs text-fuchsia-200">
                  {p2pStatus === 'connected'
                    ? 'Connected! Waiting for Host to launch the race...'
                    : 'Once Host pastes your Answer Code, the P2P DataChannel links automatically.'}
                </div>
              </div>

              {/* Guest Procedural QR Canvas */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950/90 p-3 md:col-span-5">
                {answerCode ? (
                  <>
                    <canvas
                      ref={qrCanvasRef}
                      width={184}
                      height={184}
                      className="rounded-lg border-4 border-white shadow-lg"
                      aria-label="Procedural Offline WebRTC Answer QR Code"
                    />
                    <div className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
                      Offline Answer QR • {answerCode.length} chars
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-slate-500">
                    <QrCode className="h-10 w-10 text-slate-700" />
                    <span>Paste Host Offer to generate Answer QR</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: 2-Player Local Split-Screen (Desktop) */}
        <div className="carbon-panel flex flex-col justify-between gap-3 rounded-2xl border border-amber-400/50 p-4 lg:col-span-4">
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
                <Monitor className="h-3.5 w-3.5" />
                <span>Instant Same-Screen Versus</span>
              </div>
              <h2 className="mt-0.5 text-lg font-black uppercase italic text-white">
                2-Player Local Split-Screen
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                Dual top/bottom 3D viewports on one keyboard — head-to-head plus 4 AI rivals.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/90 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black uppercase text-amber-300">Player 1 (Top)</span>
                <span className="font-mono text-[11px] text-slate-200">
                  WASD • Space Drift • L-Shift Nitro
                </span>
              </div>
              <div className="h-px bg-slate-800" />
              <div className="flex items-center justify-between">
                <span className="font-black uppercase text-rose-400">Player 2 (Bottom)</span>
                <span className="font-mono text-[11px] text-slate-200">
                  Arrows • Enter Drift • R-Shift Nitro
                </span>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Split-Screen Circuit
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {TRACK_ORDER.map((tid) => (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => setSplitTrack(tid)}
                    className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-black uppercase tracking-wider transition ${
                      splitTrack === tid
                        ? 'border-amber-400 bg-amber-500/20 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                  >
                    {TRACK_CATALOG[tid].name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStartSplitScreen(splitTrack)}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-600 px-4 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg transition hover:brightness-110"
          >
            <Users className="h-4 w-4" />
            <span>Launch 2P Split-Screen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
