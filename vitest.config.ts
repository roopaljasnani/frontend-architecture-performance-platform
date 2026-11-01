import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^platform-tokens$/, replacement: path.resolve(root, 'packages/tokens/src/index.ts') },
      { find: /^platform-vitals$/, replacement: path.resolve(root, 'packages/vitals/src/index.ts') },
      { find: /^platform-bundle-budget$/, replacement: path.resolve(root, 'packages/bundle-budget/src/index.ts') },
      { find: /^platform-profiler$/, replacement: path.resolve(root, 'packages/profiler/src/index.ts') },
      { find: /^platform-a11y$/, replacement: path.resolve(root, 'packages/a11y/src/index.ts') },
      { find: /^platform-modules$/, replacement: path.resolve(root, 'packages/modules/src/index.ts') },
      { find: /^platform-ui$/, replacement: path.resolve(root, 'packages/ui/src/index.ts') },
      { find: /^platform-data$/, replacement: path.resolve(root, 'packages/data/src/index.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx', 'apps/**/*.test.ts', 'apps/**/*.test.tsx', 'benchmarks/**/*.test.ts'],
  },
});
