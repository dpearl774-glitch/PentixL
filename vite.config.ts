import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * A browser installs a new service worker only when the worker's bytes change,
 * and public/sw.js is copied into the build untouched — so every deploy shipped
 * an identical worker, no update was ever offered, and the offline shell stayed
 * whatever the first visit had cached. Stamping each build into the token makes
 * the deploy installable and names its cache after the build, so an old build
 * can never answer from storage.
 */
const stampServiceWorker = (): Plugin => {
  let outDir = '';
  return {
    name: 'pentix-sw-stamp',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = path.join(outDir, 'sw.js');
      if (!existsSync(file)) return;
      const source = readFileSync(file, 'utf8');
      if (!source.includes('__BUILD__')) {
        throw new Error('sw.js has no __BUILD__ token: deploys would never update');
      }
      writeFileSync(file, source.replaceAll('__BUILD__', `b${Date.now().toString(36)}`), 'utf8');
    },
  };
};

export default defineConfig(() => {
  return {
    // GitHub project pages serve from https://<user>.github.io/<repo>/, so the
    // Pages workflow sets VITE_BASE_PATH. Netlify and local dev have no env
    // var and keep the domain root.
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss(), stampServiceWorker()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // The Cloud preview host changes between sessions, so it is supplied per
      // run (VITE_ALLOWED_HOSTS) / by the platform (__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS)
      // instead of being hard-coded here.
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        ...(process.env.VITE_ALLOWED_HOSTS?.split(',')
          .map((host) => host.trim())
          .filter(Boolean) ?? []),
      ],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
