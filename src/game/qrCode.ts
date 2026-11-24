import { generateQrMatrix } from './p2p';

/**
 * Generates an inline SVG data string for a scannable QR code using the
 * deterministic ISO/IEC 18004 matrix generator.
 */
export function generateQrSvgString(text: string, sizePx = 176): string {
  const matrix = generateQrMatrix(text);
  const n = matrix.length;
  const quiet = 2;
  const total = n + quiet * 2;
  const cell = sizePx / total;

  let rects = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix[y][x]) {
        const rx = ((x + quiet) * cell).toFixed(2);
        const ry = ((y + quiet) * cell).toFixed(2);
        const rw = (cell + 0.15).toFixed(2);
        rects += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rw}" fill="#05070d"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}"><rect width="${sizePx}" height="${sizePx}" rx="8" fill="#ffffff"/>${rects}</svg>`;
}

/**
 * Draws a QR matrix directly onto a Canvas 2D context for offline rendering/export.
 */
export function drawQrToCanvas(canvas: HTMLCanvasElement, text: string): void {
  const matrix = generateQrMatrix(text);
  const n = matrix.length;
  const quiet = 2;
  const total = n + quiet * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const cellW = w / total;
  const cellH = h / total;
  ctx.fillStyle = '#05070d';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix[y][x]) {
        ctx.fillRect((x + quiet) * cellW, (y + quiet) * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
  }
}

export { generateQrMatrix };
