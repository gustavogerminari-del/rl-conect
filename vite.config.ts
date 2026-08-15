import tailwindcss from '@tailwindcss/vite';
import {cloudflare} from '@cloudflare/vite-plugin';
import path from 'node:path';
import vinext from 'vinext';
import {defineConfig} from 'vite';

export default defineConfig(() => ({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
