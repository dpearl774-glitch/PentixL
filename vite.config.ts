import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
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
