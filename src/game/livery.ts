import * as THREE from 'three';
import type { LiveryConfig } from './types';

/**
 * Generates a high-resolution procedural racing livery diffuse texture
 * with customizable stripes, contrasting hood wrap, and side-door racing number.
 */
export function createLiveryTexture(
  baseColor: string,
  livery: LiveryConfig
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base body paint
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  const stripeColor =
    livery.stripeStyle === 'none' ? baseColor : '#f8fafc';

  if (livery.stripeStyle === 'twin_center') {
    ctx.fillStyle = stripeColor;
    ctx.fillRect(214, 0, 32, 512);
    ctx.fillRect(266, 0, 32, 512);
  } else if (livery.stripeStyle === 'offset_gt') {
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(148, 0, 44, 512);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(198, 0, 14, 512);
  } else if (livery.stripeStyle === 'viper') {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(190, 0);
    ctx.lineTo(240, 0);
    ctx.lineTo(230, 512);
    ctx.lineTo(205, 512);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(272, 0);
    ctx.lineTo(322, 0);
    ctx.lineTo(307, 512);
    ctx.lineTo(282, 512);
    ctx.closePath();
    ctx.fill();
  }

  // Contrasting hood wrap (upper UV band)
  if (livery.hoodWrap !== 'body') {
    ctx.fillStyle = livery.hoodWrap === 'carbon' ? '#141923' : '#090b10';
    ctx.fillRect(88, 24, 336, 148);
    if (livery.hoodWrap === 'carbon') {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = 24; y < 172; y += 8) {
        for (let x = 88; x < 424; x += 8) {
          if (((x + y) / 8) % 2 === 0) {
            ctx.fillRect(x, y, 4, 4);
          }
        }
      }
    }
  }

  // Side-door racing number roundel
  const num = (livery.racingNumber || '07').slice(0, 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(92, 310, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num, 92, 312);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}
