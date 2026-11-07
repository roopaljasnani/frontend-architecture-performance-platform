import { claimsFrom, resolveShared, type ModuleContract } from 'platform-modules';
import { describe, expect, it } from 'vitest';
import { adoptionReport, catalogModules, catalogRegistry } from './index';

const shellModule: ModuleContract = {
  id: 'overview',
  version: '1.0.0',
  owner: 'platform',
  title: 'Platform',
  route: '/',
  budgets: { maxGzipBytes: 80_000, maxInpMs: 200 },
  shared: [
    { name: 'react', range: '^18.3.1' },
    { name: 'react-dom', range: '^18.3.1' },
  ],
};

describe('catalog product on the platform', () => {
  it('shares React 18, contrast, and the release gate with the shell', () => {
    const report = adoptionReport([shellModule, { ...shellModule, id: 'vitals', route: '/vitals' }]);
    expect(report.reactOk).toBe(true);
    expect(report.reactMajor).toBe(18);
    expect(report.contrastOk).toBe(true);
    expect(report.searchShips).toBe(true);
    expect(report.browseShips).toBe(false);
    expect(report.rowsFull).toBe(4000);
    expect(report.rowsMounted).toBe(18);
  });

  it('refuses a second React major on the catalog registry', () => {
    const registry = catalogRegistry();
    expect(registry.list().map((module) => module.id)).toEqual(catalogModules.map((module) => module.id));
    const broken = resolveShared(claimsFrom([
      ...catalogModules,
      { ...catalogModules[0], id: 'legacy-browse', shared: [{ name: 'react', range: '^17.0.2' }] },
    ]));
    expect(broken.ok).toBe(false);
  });
});
