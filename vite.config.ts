import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces dist/index.html: one self-contained file you can
// double-click to play (no server needed).
export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
} as any);
