import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ and injects all built assets into dist/sw.js for 100% offline PWA
      {
        name: 'pwa-offline-precache',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }

          const swPath = path.join(distDir, 'sw.js');
          if (!fs.existsSync(distDir) || !fs.existsSync(swPath)) {
            return;
          }

          const collected: string[] = ['/'];
          const walk = (dir: string) => {
            for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                walk(full);
              } else {
                const rel = '/' + path.relative(distDir, full).replace(/\\/g, '/');
                if (rel === '/sw.js' || rel.endsWith('.map')) continue;
                collected.push(rel);
              }
            }
          };
          walk(distDir);

          const swContent = fs.readFileSync(swPath, 'utf8');
          const updatedSw = swContent.replace(
            /const PRECACHE_ASSETS = \[[\s\S]*?\];/,
            `const PRECACHE_ASSETS = ${JSON.stringify(Array.from(new Set(collected)))};`
          );
          fs.writeFileSync(swPath, updatedSw, 'utf8');
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
