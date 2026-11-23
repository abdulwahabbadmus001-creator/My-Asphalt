import * as THREE from 'three';
import type { TrackId } from './types';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

/**
 * Generates a 100% offline 6-face procedural sky/horizon cubemap for PMREMGenerator
 * so automotive clearcoat paint, glass canopies, chrome rims, and Rainy Night puddles
 * display environment-accurate horizon & overhead studio/neon specular reflections.
 */
export function createProceduralSkyCubemap(theme: TrackId | 'showroom'): THREE.CubeTexture {
  const size = 128;
  const palettes: Record<
    TrackId | 'showroom',
    { zenith: string; mid: string; horizon: string; ground: string; accentA: string; accentB: string }
  > = {
    showroom: {
      zenith: '#0f172a',
      mid: '#1e293b',
      horizon: '#38bdf8',
      ground: '#090d16',
      accentA: '#ffffff',
      accentB: '#e879f9',
    },
    coastal: {
      zenith: '#0284c7',
      mid: '#38bdf8',
      horizon: '#fef3c7',
      ground: '#1e3a5f',
      accentA: '#fffbeb',
      accentB: '#7dd3fc',
    },
    desert: {
      zenith: '#7c2d12',
      mid: '#ea580c',
      horizon: '#fde68a',
      ground: '#431407',
      accentA: '#fff7ed',
      accentB: '#fb923c',
    },
    night: {
      zenith: '#050816',
      mid: '#151030',
      horizon: '#c026d3',
      ground: '#070a14',
      accentA: '#22d3ee',
      accentB: '#f0abfc',
    },
    alpine: {
      zenith: '#1d4ed8',
      mid: '#60a5fa',
      horizon: '#f0f9ff',
      ground: '#334155',
      accentA: '#ffffff',
      accentB: '#bae6fd',
    },
  };

  const p = palettes[theme];
  const faces: HTMLCanvasElement[] = [];

  // Order: +x, -x, +y (top), -y (bottom), +z, -z
  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    const [canvas, ctx] = makeCanvas(size, size);

    if (faceIdx === 2) {
      // +Y Sky / Studio Overhead Ceiling
      ctx.fillStyle = p.zenith;
      ctx.fillRect(0, 0, size, size);
      if (theme === 'showroom') {
        // Softbox studio light strips for razor automotive clearcoat reflections
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(14, 20, size - 28, 16);
        ctx.fillRect(14, 56, size - 28, 16);
        ctx.fillRect(14, 92, size - 28, 16);
      } else {
        const sunGrad = ctx.createRadialGradient(size * 0.65, size * 0.35, 4, size * 0.65, size * 0.35, 48);
        sunGrad.addColorStop(0, p.accentA);
        sunGrad.addColorStop(0.4, p.accentB);
        sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, size, size);
      }
    } else if (faceIdx === 3) {
      // -Y Ground reflection
      ctx.fillStyle = p.ground;
      ctx.fillRect(0, 0, size, size);
    } else {
      // Side horizon faces (+X, -X, +Z, -Z)
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, p.zenith);
      grad.addColorStop(0.44, p.mid);
      grad.addColorStop(0.52, p.horizon);
      grad.addColorStop(0.56, p.ground);
      grad.addColorStop(1, p.ground);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      if (theme === 'night') {
        // Neon city skyline silhouette & glowing vertical reflections
        for (let x = 4; x < size; x += 12) {
          const h = 14 + ((x * 7 + faceIdx * 19) % 34);
          ctx.fillStyle = '#090d1c';
          ctx.fillRect(x, size * 0.52 - h, 9, h);
          ctx.fillStyle = (x + faceIdx) % 2 === 0 ? '#22d3ee' : '#e879f9';
          ctx.fillRect(x + 2, size * 0.52 - h + 3, 5, 3);
          ctx.fillRect(x + 2, size * 0.52 - h + 10, 5, 3);
        }
      } else if (theme === 'showroom') {
        // Horizontal architectural accent light bands
        ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.fillRect(0, size * 0.48, size, 3);
        ctx.fillStyle = 'rgba(232, 121, 249, 0.5)';
        ctx.fillRect(0, size * 0.28, size, 2);
      } else if (faceIdx === 0 || faceIdx === 4) {
        // Bright solar horizon flare
        const flare = ctx.createRadialGradient(size * 0.5, size * 0.45, 3, size * 0.5, size * 0.45, 36);
        flare.addColorStop(0, p.accentA);
        flare.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = flare;
        ctx.fillRect(0, 0, size, size);
      }
    }

    faces.push(canvas);
  }

  const cubeTex = new THREE.CubeTexture(faces);
  cubeTex.colorSpace = THREE.SRGBColorSpace;
  cubeTex.needsUpdate = true;
  return cubeTex;
}

let cachedFlakeTex: THREE.CanvasTexture | null = null;

/**
 * Procedural metallic-flake micro-roughness texture for automotive clearcoat PBR paint.
 */
export function createMetallicFlakeRoughnessMap(maxAniso: number): THREE.CanvasTexture {
  if (cachedFlakeTex) return cachedFlakeTex;
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#323232'; // ~0.20 base roughness
  ctx.fillRect(0, 0, 256, 256);

  // Subtle metallic micro-flake sparkle variations
  for (let i = 0; i < 9500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 22 + Math.floor(Math.random() * 68);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = Math.min(4, maxAniso);
  cachedFlakeTex = tex;
  return tex;
}

let cachedCarbonTex: THREE.CanvasTexture | null = null;

/**
 * Procedural diagonal twill carbon-fiber weave texture for splitters, diffusers, skirts, and wings.
 */
export function createCarbonFiberTexture(maxAniso = 4): THREE.CanvasTexture {
  if (cachedCarbonTex) return cachedCarbonTex;
  const [canvas, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = '#0d1118';
  ctx.fillRect(0, 0, 64, 64);

  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const shift = (y / 8) % 2 === 0 ? 0 : 4;
      ctx.fillStyle = '#1b2230';
      ctx.fillRect((x + shift) % 64, y, 4, 4);
      ctx.fillStyle = '#242d3e';
      ctx.fillRect((x + shift + 4) % 64, y + 4, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = Math.min(4, maxAniso);
  cachedCarbonTex = tex;
  return tex;
}

/**
 * Procedural screen-space-style reflection texture for Rainy Neon Night City road puddles.
 * Encodes inverted neon skyline streaks, cyan/magenta streetlight blooms, and organic feathered puddle alpha.
 */
export function createPuddleReflectionTexture(maxAniso: number): {
  map: THREE.CanvasTexture;
  alphaMap: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(256, 512);
  // Deep midnight sky reflection gradient
  const bg = ctx.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, '#090d24');
  bg.addColorStop(0.5, '#171238');
  bg.addColorStop(1, '#080c1c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 512);

  // Reflected neon skyscraper streaks (vertical wet-asphalt SSR stretch!)
  const colors = [
    'rgba(34, 211, 238, 0.72)',
    'rgba(232, 121, 249, 0.72)',
    'rgba(245, 158, 11, 0.55)',
    'rgba(56, 189, 248, 0.65)',
  ];
  for (let i = 0; i < 28; i++) {
    const x = 22 + Math.random() * 212;
    const y = 20 + Math.random() * 340;
    const w = 6 + Math.random() * 14;
    const h = 48 + Math.random() * 130;
    const c = colors[i % colors.length];
    const streak = ctx.createLinearGradient(0, y, 0, y + h);
    streak.addColorStop(0, 'rgba(0,0,0,0)');
    streak.addColorStop(0.35, c);
    streak.addColorStop(0.65, c);
    streak.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(x, y, w, h);
  }

  // Subtle concentric raindrop ripple rings inside the puddle reflection
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.28)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    const rx = 50 + Math.random() * 156;
    const ry = 70 + Math.random() * 372;
    const r = 8 + Math.random() * 20;
    ctx.beginPath();
    ctx.ellipse(rx, ry, r, r * 1.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Organic puddle shape alpha mask
  const [aCanvas, aCtx] = makeCanvas(256, 512);
  aCtx.fillStyle = '#000000';
  aCtx.fillRect(0, 0, 256, 512);
  const blobs = [
    { x: 128, y: 256, rx: 100, ry: 205 },
    { x: 96, y: 185, rx: 72, ry: 118 },
    { x: 162, y: 328, rx: 68, ry: 112 },
  ];
  for (const b of blobs) {
    const grad = aCtx.createRadialGradient(b.x, b.y, 12, b.x, b.y, Math.max(b.rx, b.ry));
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.68, 'rgba(255,255,255,0.68)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    aCtx.fillStyle = grad;
    aCtx.save();
    aCtx.translate(b.x, b.y);
    aCtx.scale(b.rx / Math.max(b.rx, b.ry), b.ry / Math.max(b.rx, b.ry));
    aCtx.beginPath();
    aCtx.arc(0, 0, Math.max(b.rx, b.ry), 0, Math.PI * 2);
    aCtx.fill();
    aCtx.restore();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, maxAniso);

  const alphaMap = new THREE.CanvasTexture(aCanvas);
  alphaMap.anisotropy = Math.min(4, maxAniso);

  return { map, alphaMap };
}

let cachedSmokeTex: THREE.CanvasTexture | null = null;

/**
 * Volumetric radial tire-smoke puff texture for drift clouds.
 */
export function createSmokePuffTexture(): THREE.CanvasTexture {
  if (cachedSmokeTex) return cachedSmokeTex;
  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(226, 232, 240, 0.85)');
  grad.addColorStop(0.45, 'rgba(203, 213, 225, 0.42)');
  grad.addColorStop(1, 'rgba(148, 163, 184, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedSmokeTex = tex;
  return tex;
}

export function createAsphaltTexture(trackId: TrackId, maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);

  const baseTone =
    trackId === 'night'
      ? '#10141f'
      : trackId === 'desert'
        ? '#312c29'
        : trackId === 'alpine'
          ? '#222732'
          : '#252932';
  ctx.fillStyle = baseTone;
  ctx.fillRect(0, 0, 512, 512);

  // Fine aggregate asphalt grain
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.floor(22 + Math.random() * 44);
    ctx.fillStyle = `rgb(${v},${v},${v + (trackId === 'night' ? 14 : 6)})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Tire wear tracks
  ctx.fillStyle = 'rgba(8, 10, 14, 0.28)';
  ctx.fillRect(98, 0, 58, 512);
  ctx.fillRect(356, 0, 58, 512);

  // Wet rain sheen puddles for Night City
  if (trackId === 'night') {
    for (let i = 0; i < 18; i++) {
      const px = 60 + Math.random() * 392;
      const py = Math.random() * 512;
      const rx = 20 + Math.random() * 42;
      const ry = 45 + Math.random() * 90;
      const grad = ctx.createRadialGradient(px, py, 2, px, py, Math.max(rx, ry));
      grad.addColorStop(0, 'rgba(90, 145, 235, 0.14)');
      grad.addColorStop(1, 'rgba(20, 30, 50, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Light frost/salt dust on Alpine edges
  if (trackId === 'alpine') {
    const leftFrost = ctx.createLinearGradient(0, 0, 72, 0);
    leftFrost.addColorStop(0, 'rgba(226, 240, 255, 0.42)');
    leftFrost.addColorStop(1, 'rgba(226, 240, 255, 0)');
    ctx.fillStyle = leftFrost;
    ctx.fillRect(0, 0, 72, 512);

    const rightFrost = ctx.createLinearGradient(512, 0, 440, 0);
    rightFrost.addColorStop(0, 'rgba(226, 240, 255, 0.42)');
    rightFrost.addColorStop(1, 'rgba(226, 240, 255, 0)');
    ctx.fillStyle = rightFrost;
    ctx.fillRect(440, 0, 72, 512);
  }

  // Edge solid lines
  ctx.fillStyle =
    trackId === 'night'
      ? '#22d3ee'
      : trackId === 'alpine'
        ? '#e0f2fe'
        : '#f8fafc';
  ctx.fillRect(20, 0, 12, 512);
  ctx.fillRect(480, 0, 12, 512);

  // Dashed racing lane centerline
  ctx.fillStyle =
    trackId === 'night'
      ? '#f0abfc'
      : trackId === 'desert'
        ? '#fbbf24'
        : trackId === 'alpine'
          ? '#38bdf8'
          : '#f8fafc';
  for (let y = 16; y < 512; y += 96) {
    ctx.fillRect(250, y, 12, 50);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso);
  return tex;
}

export function createWetRoadRoughnessTexture(maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#484848';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 24; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 18 + Math.random() * 34;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(1, 'rgba(72,72,72,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}

export function createCurbTexture(trackId: TrackId, maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 256);
  const c1 =
    trackId === 'night'
      ? '#d946ef'
      : trackId === 'desert'
        ? '#ea580c'
        : trackId === 'alpine'
          ? '#0284c7'
          : '#dc2626';
  const c2 = trackId === 'night' ? '#0ea5e9' : '#f8fafc';

  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? c1 : c2;
    ctx.fillRect(0, i * 64, 128, 64);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}

export function createGroundTexture(trackId: TrackId, maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);

  if (trackId === 'coastal') {
    ctx.fillStyle = '#3b6e3c';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8000; i++) {
      const g = 88 + Math.floor(Math.random() * 48);
      ctx.fillStyle = `rgb(${Math.floor(g * 0.56)}, ${g}, ${Math.floor(g * 0.45)})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }
  } else if (trackId === 'desert') {
    ctx.fillStyle = '#a8643a';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8000; i++) {
      const r = 148 + Math.floor(Math.random() * 54);
      ctx.fillStyle = `rgb(${r}, ${Math.floor(r * 0.62)}, ${Math.floor(r * 0.38)})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }
  } else if (trackId === 'alpine') {
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const bright = Math.random() > 0.28;
      if (bright) {
        const v = 218 + Math.floor(Math.random() * 36);
        ctx.fillStyle = `rgb(${v - 6}, ${v}, ${Math.min(255, v + 8)})`;
      } else {
        const v = 138 + Math.floor(Math.random() * 36);
        ctx.fillStyle = `rgb(${v}, ${v + 8}, ${v + 18})`;
      }
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
    }
  } else {
    ctx.fillStyle = '#0c1020';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.14)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(42, 42);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}

export function createBoostPadTexture(maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#041224';
  ctx.fillRect(0, 0, 256, 512);

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#06b6d4');
  grad.addColorStop(0.5, '#67e8f9');
  grad.addColorStop(1, '#06b6d4');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let y = 76; y < 500; y += 112) {
    ctx.beginPath();
    ctx.moveTo(36, y + 48);
    ctx.lineTo(128, y - 16);
    ctx.lineTo(220, y + 48);
    ctx.stroke();
  }

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 502);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}

export function createRampTexture(maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 256, 512);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 4;
  for (let i = -256; i < 768; i += 24) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 512);
    ctx.stroke();
  }

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 24;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let y = 90; y < 480; y += 120) {
    ctx.beginPath();
    ctx.moveTo(38, y + 52);
    ctx.lineTo(128, y - 18);
    ctx.lineTo(218, y + 52);
    ctx.stroke();
  }

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, 14, 512);
  ctx.fillRect(242, 0, 14, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}

export function createHazardBarrierTexture(maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#18181b';
  for (let x = -128; x < 384; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 24, 0);
    ctx.lineTo(x + 68, 128);
    ctx.lineTo(x + 44, 128);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}

export function createCheckeredTexture(maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 128);
  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      const dark = ((x / sq) + (y / sq)) % 2 === 0;
      ctx.fillStyle = dark ? '#0f172a' : '#f8fafc';
      ctx.fillRect(x, y, sq, sq);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}

export function createShowroomFloorTexture(maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#121622';
  ctx.fillRect(0, 0, 512, 512);

  const grad = ctx.createRadialGradient(256, 256, 18, 256, 256, 240);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
  grad.addColorStop(0.45, 'rgba(217, 70, 239, 0.08)');
  grad.addColorStop(1, 'rgba(10, 13, 22, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}

export function createBuildingFacadeTexture(maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#090d1a';
  ctx.fillRect(0, 0, 256, 512);

  const palette = ['#22d3ee', '#e879f9', '#f59e0b', '#38bdf8'];
  for (let y = 14; y < 500; y += 22) {
    for (let x = 14; x < 244; x += 28) {
      if (Math.random() > 0.34) {
        ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        ctx.globalAlpha = 0.45 + Math.random() * 0.55;
        ctx.fillRect(x, y, 16, 10);
      }
    }
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}
