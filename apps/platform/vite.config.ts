import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { platformApi } from './api-plugin';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function pagesBase(): string {
  const fromEnv = process.env.VITE_BASE_PATH;
  if (!fromEnv || fromEnv === '/') return '/';
  return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`;
}

export default defineConfig({
  base: pagesBase(),
  plugins: [react(), platformApi()],
  build: {
    manifest: true,
  },
  resolve: {
    alias: [
      { find: /^platform-tokens$/, replacement: path.resolve(repoRoot, 'packages/tokens/src/index.ts') },
      { find: /^platform-vitals$/, replacement: path.resolve(repoRoot, 'packages/vitals/src/index.ts') },
      { find: /^platform-bundle-budget$/, replacement: path.resolve(repoRoot, 'packages/bundle-budget/src/index.ts') },
      { find: /^platform-profiler$/, replacement: path.resolve(repoRoot, 'packages/profiler/src/index.ts') },
      { find: /^platform-a11y$/, replacement: path.resolve(repoRoot, 'packages/a11y/src/index.ts') },
      { find: /^platform-modules$/, replacement: path.resolve(repoRoot, 'packages/modules/src/index.ts') },
      { find: /^platform-ui$/, replacement: path.resolve(repoRoot, 'packages/ui/src/index.ts') },
      { find: /^platform-data$/, replacement: path.resolve(repoRoot, 'packages/data/src/index.ts') },
      { find: /^platform-catalog$/, replacement: path.resolve(repoRoot, 'packages/catalog-product/src/index.ts') },
    ],
  },
  server: {
    port: 5173,
  },
});
