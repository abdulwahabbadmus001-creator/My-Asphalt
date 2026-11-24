/**
 * Zero-data local Wi-Fi Hotspot 1v1 WebRTC DataChannel helpers.
 * Uses iceServers: [] (host-only local ICE candidates) and SDP minification
 * so pairing tokens stay compact for instant QR scanning.
 */

export function minifySdp(sdp: string): string {
  const keepPrefixes = [
    'v=',
    'o=',
    's=',
    't=',
    'm=application',
    'c=',
    'a=ice-ufrag:',
    'a=ice-pwd:',
    'a=fingerprint:',
    'a=setup:',
    'a=mid:',
    'a=sctp-port:',
    'a=candidate:',
    'a=end-of-candidates',
  ];
  return sdp
    .split(/\r?\n/)
    .filter((line) => keepPrefixes.some((p) => line.startsWith(p)))
    .join('\r\n') + '\r\n';
}

export interface HotspotStatePacket {
  type: 'hotspot_state';
  s: number;
  d: number;
  y: number;
  yaw: number;
  speed: number;
  drift: number;
  nitro: boolean;
  shockwave: boolean;
  shuntDir: number;
  integrity: number;
  drowning: boolean;
  ts: number;
}

export class HotspotThrottle {
  private lastSendMs = 0;
  private readonly intervalMs = 1000 / 30; // 30 Hz low-latency stream

  public shouldSend(nowMs: number): boolean {
    if (nowMs - this.lastSendMs < this.intervalMs) return false;
    this.lastSendMs = nowMs;
    return true;
  }
}
