import { describe, expect, it } from 'vitest';
import { filesForModule, type ViteManifest } from './manifest';

const manifest: ViteManifest = {
  'index.html': { file: 'assets/index.js', isEntry: true, imports: ['_vendor.js'], css: ['assets/shell.css'] },
  '_vendor.js': { file: 'assets/vendor.js' },
  'src/screens/vitals.tsx': { file: 'assets/vitals.js', isDynamicEntry: true, imports: ['_vendor.js'] },
};

describe('vite manifest route files', () => {
  it('includes the shell, the screen, and the shared chunk once', () => {
    expect(filesForModule(manifest, 'vitals')).toEqual([
      'assets/index.js',
      'assets/shell.css',
      'assets/vendor.js',
      'assets/vitals.js',
    ]);
  });

  it('fails closed when a screen was not built', () => {
    expect(() => filesForModule(manifest, 'missing')).toThrow(/missing screen/);
  });
});
