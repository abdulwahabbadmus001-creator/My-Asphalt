import type { CarId, P2PNetState, P2PPacket, TrackId } from './types';

export interface SignalPayload {
  v: 1;
  t: 'offer' | 'answer';
  sdp: string;
  name: string;
  carId: CarId;
  color: string;
  trackId?: TrackId;
}

/**
 * Compacts WebRTC SDP for shorter offline Base64 codes & QR codes
 * while preserving ICE candidates, ufrag/pwd, DTLS fingerprint, and SCTP data channel lines.
 */
export function compactSdp(sdp: string): string {
  return sdp
    .split(/\r?\n/)
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith('a=extmap')) return false;
      if (line.startsWith('a=msid-semantic')) return false;
      return true;
    })
    .join('\n');
}

export function encodeSignalPayload(payload: SignalPayload): string {
  const json = JSON.stringify({
    ...payload,
    sdp: compactSdp(payload.sdp),
  });
  // Safe UTF-8 -> Base64url encoding without external deps
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return 'MA1:' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSignalPayload(code: string): SignalPayload | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith('MA1:')) return null;
  try {
    let b64 = trimmed.slice(4).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    let json = '';
    if (typeof atob === 'function') {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      json = new TextDecoder().decode(bytes);
    } else {
      json = Buffer.from(b64, 'base64').toString('utf8');
    }
    const parsed = JSON.parse(json) as Partial<SignalPayload>;
    if (
      parsed.v !== 1 ||
      (parsed.t !== 'offer' && parsed.t !== 'answer') ||
      typeof parsed.sdp !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.carId !== 'string'
    ) {
      return null;
    }
    return {
      v: 1,
      t: parsed.t,
      sdp: parsed.sdp.endsWith('\n') ? parsed.sdp : `${parsed.sdp}\r\n`,
      name: parsed.name,
      carId: parsed.carId as CarId,
      color: typeof parsed.color === 'string' ? parsed.color : '#2563eb',
      trackId: parsed.trackId,
    };
  } catch {
    return null;
  }
}

/**
 * Pure deterministic procedural 2D QR-style visual matrix generator (zero external packages).
 * Produces standard 3-corner finder patterns, timing bars, and deterministic payload modules.
 */
export function generateQrMatrix(text: string, size = 33): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          grid[rr][cc] = false;
        } else if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          grid[rr][cc] = true;
        } else {
          grid[rr][cc] = false;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing tracks
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Alignment square near bottom-right
  const aPos = size - 9;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = aPos + r;
      const cc = aPos + c;
      reserved[rr][cc] = true;
      grid[rr][cc] =
        Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
    }
  }

  // Encode payload bytes + hash spread into remaining modules
  const bytes = new TextEncoder().encode(text || 'MY_ASPHALT');
  let bitStreamIdx = 0;
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      const byteVal = bytes[bitStreamIdx % bytes.length];
      const bit = (byteVal >> (bitStreamIdx % 8)) & 1;
      const mask = ((r + c) % 2 === 0 ? 1 : 0) ^ ((hash >>> (bitStreamIdx % 24)) & 1);
      grid[r][c] = (bit ^ mask) === 1;
      bitStreamIdx++;
    }
  }

  return grid;
}

export function renderQrToCanvas(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const matrix = generateQrMatrix(text, 33);
  const quiet = 3;
  const modules = matrix.length + quiet * 2;
  const cell = Math.floor(Math.min(canvas.width, canvas.height) / modules);
  const totalPx = cell * modules;
  const ox = Math.floor((canvas.width - totalPx) / 2);
  const oy = Math.floor((canvas.height - totalPx) / 2);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#090d16';
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(ox + (c + quiet) * cell, oy + (r + quiet) * cell, cell, cell);
      }
    }
  }
}

export type P2PConnectionStatus =
  | 'idle'
  | 'gathering'
  | 'waiting_answer'
  | 'connecting'
  | 'connected'
  | 'error';

export interface P2PRemotePeerInfo {
  name: string;
  carId: CarId;
  bodyColor: string;
}

/**
 * Pure Offline Serverless WebRTC DataChannel Manager.
 * Uses iceServers: [] so two devices on the same Wi-Fi or mobile hotspot
 * connect directly via local LAN ICE candidates with zero internet server.
 */
export class OfflineP2PManager {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private status: P2PConnectionStatus = 'idle';
  private isHost = false;
  private remoteInfo: P2PRemotePeerInfo | null = null;
  private latestRemoteState: P2PNetState | null = null;
  private lastSendTime = 0;

  private onStatusChange: (status: P2PConnectionStatus, detail?: string) => void;
  private onPacket: (packet: P2PPacket) => void;

  constructor(
    onStatusChange: (status: P2PConnectionStatus, detail?: string) => void,
    onPacket: (packet: P2PPacket) => void
  ) {
    this.onStatusChange = onStatusChange;
    this.onPacket = onPacket;
  }

  public getStatus(): P2PConnectionStatus {
    return this.status;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getRemoteInfo(): P2PRemotePeerInfo | null {
    return this.remoteInfo;
  }

  public getLatestRemoteState(): P2PNetState | null {
    return this.latestRemoteState;
  }

  public resetRemoteState(): void {
    this.latestRemoteState = null;
  }

  private setStatus(s: P2PConnectionStatus, detail?: string): void {
    this.status = s;
    this.onStatusChange(s, detail);
  }

  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }, 1800);
      const onChange = () => {
        if (pc.iceGatheringState === 'complete') {
          window.clearTimeout(timeout);
          pc.removeEventListener('icegatheringstatechange', onChange);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', onChange);
    });
  }

  private wireDataChannel(channel: RTCDataChannel): void {
    this.dc = channel;
    channel.onopen = () => {
      this.setStatus('connected', 'Direct 60Hz LAN DataChannel Open');
    };
    channel.onclose = () => {
      if (this.status === 'connected') {
        this.setStatus('idle', 'Peer disconnected');
      }
    };
    channel.onmessage = (ev) => {
      try {
        const pkt = JSON.parse(String(ev.data)) as P2PPacket;
        if (pkt.type === 'state') {
          this.latestRemoteState = pkt;
        } else if (pkt.type === 'hello') {
          this.remoteInfo = {
            name: pkt.name,
            carId: pkt.carId,
            bodyColor: pkt.bodyColor,
          };
        }
        this.onPacket(pkt);
      } catch {
        // Ignore malformed packets
      }
    };
  }

  public async createHostOffer(
    hostName: string,
    hostCarId: CarId,
    hostColor: string,
    trackId: TrackId
  ): Promise<string> {
    this.close();
    this.isHost = true;
    this.setStatus('gathering', 'Gathering local Wi-Fi / Hotspot ICE candidates...');

    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;

    // Low-latency unordered channel for 60Hz racing telemetry
    const channel = pc.createDataChannel('my-asphalt-race', {
      ordered: false,
      maxRetransmits: 0,
    });
    this.wireDataChannel(channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.waitForIceGathering(pc);

    const fullSdp = pc.localDescription?.sdp ?? offer.sdp ?? '';
    const code = encodeSignalPayload({
      v: 1,
      t: 'offer',
      sdp: fullSdp,
      name: hostName,
      carId: hostCarId,
      color: hostColor,
      trackId,
    });

    this.setStatus('waiting_answer', 'Share Offer Code or QR with Guest device');
    return code;
  }

  public async acceptGuestAnswer(answerCode: string): Promise<boolean> {
    if (!this.pc || !this.isHost) return false;
    const payload = decodeSignalPayload(answerCode);
    if (!payload || payload.t !== 'answer') {
      this.setStatus('error', 'Invalid Guest Answer Code');
      return false;
    }
    try {
      this.remoteInfo = {
        name: payload.name,
        carId: payload.carId,
        bodyColor: payload.color,
      };
      this.setStatus('connecting', `Linking with ${payload.name}...`);
      await this.pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
      return true;
    } catch {
      this.setStatus('error', 'Could not establish local WebRTC link');
      return false;
    }
  }

  public async acceptHostOfferAndCreateAnswer(
    offerCode: string,
    guestName: string,
    guestCarId: CarId,
    guestColor: string
  ): Promise<{ answerCode: string; hostInfo: P2PRemotePeerInfo; trackId: TrackId } | null> {
    const payload = decodeSignalPayload(offerCode);
    if (!payload || payload.t !== 'offer') {
      this.setStatus('error', 'Invalid Host Offer Code');
      return null;
    }

    this.close();
    this.isHost = false;
    this.remoteInfo = {
      name: payload.name,
      carId: payload.carId,
      bodyColor: payload.color,
    };

    try {
      this.setStatus('gathering', 'Generating Answer Code...');
      const pc = new RTCPeerConnection({ iceServers: [] });
      this.pc = pc;
      pc.ondatachannel = (ev) => {
        this.wireDataChannel(ev.channel);
      };

      await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.waitForIceGathering(pc);

      const fullSdp = pc.localDescription?.sdp ?? answer.sdp ?? '';
      const answerCode = encodeSignalPayload({
        v: 1,
        t: 'answer',
        sdp: fullSdp,
        name: guestName,
        carId: guestCarId,
        color: guestColor,
      });

      this.setStatus('connecting', 'Send Answer Code back to Host to connect');
      return {
        answerCode,
        hostInfo: this.remoteInfo,
        trackId: payload.trackId ?? 'night',
      };
    } catch {
      this.setStatus('error', 'Failed to parse Host Offer');
      return null;
    }
  }

  public sendPacket(packet: P2PPacket): void {
    if (!this.dc || this.dc.readyState !== 'open') return;
    try {
      this.dc.send(JSON.stringify(packet));
    } catch {
      // Ignore backpressure drops on unreliable channel
    }
  }

  /** Throttled 60Hz state emitter (~16ms interval) */
  public sendState60Hz(state: P2PNetState, nowMs: number): void {
    if (nowMs - this.lastSendTime < 16) return;
    this.lastSendTime = nowMs;
    this.sendPacket(state);
  }

  public close(): void {
    try {
      this.dc?.close();
      this.pc?.close();
    } catch {
      // ignore
    }
    this.dc = null;
    this.pc = null;
    this.latestRemoteState = null;
    this.status = 'idle';
  }
}
