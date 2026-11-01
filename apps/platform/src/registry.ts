import { createRegistry, type ModuleContract, type RegisteredModule } from 'platform-modules';
import type { ComponentType } from 'react';

export interface ScreenModule {
  default: ComponentType;
}

const react18 = [
  { name: 'react', range: '^18.3.1' },
  { name: 'react-dom', range: '^18.3.1' },
];

function define(
  contract: Omit<ModuleContract, 'shared' | 'version'>,
  load: RegisteredModule<ScreenModule>['load'],
): RegisteredModule<ScreenModule> {
  return { version: '1.0.0', shared: react18, ...contract, load };
}

export function createPlatformRegistry() {
  const registry = createRegistry<ScreenModule>();
  for (const module of [
    define(
      { id: 'overview', owner: 'platform', title: 'Platform', route: '/', budgets: { maxGzipBytes: 80_000, maxInpMs: 200 } },
      () => import('./screens/overview'),
    ),
    define(
      { id: 'vitals', owner: 'performance', title: 'Vitals', route: '/vitals', budgets: { maxGzipBytes: 90_000, maxInpMs: 200 } },
      () => import('./screens/vitals'),
    ),
    define(
      { id: 'bundles', owner: 'performance', title: 'Bundles', route: '/bundles', budgets: { maxGzipBytes: 90_000, maxInpMs: 200 } },
      () => import('./screens/bundles'),
    ),
    define(
      { id: 'runtime', owner: 'performance', title: 'Runtime', route: '/runtime', budgets: { maxGzipBytes: 100_000, maxInpMs: 200 } },
      () => import('./screens/runtime'),
    ),
    define(
      { id: 'data', owner: 'catalog', title: 'Data', route: '/data', budgets: { maxGzipBytes: 90_000, maxInpMs: 200 } },
      () => import('./screens/data'),
    ),
    define(
      { id: 'accessibility', owner: 'accessibility', title: 'Accessibility', route: '/accessibility', budgets: { maxGzipBytes: 80_000, maxInpMs: 200 } },
      () => import('./screens/accessibility'),
    ),
    define(
      { id: 'decisions', owner: 'platform', title: 'Decisions', route: '/decisions', budgets: { maxGzipBytes: 64_000, maxInpMs: 200 } },
      () => import('./screens/decisions'),
    ),
  ]) {
    registry.register(module);
  }
  return registry;
}

export const platformRegistry = createPlatformRegistry();

export const rejectedLegacyModule: ModuleContract = {
  id: 'legacy-checkout',
  version: '0.9.0',
  owner: 'payments',
  title: 'Legacy checkout',
  route: '/checkout',
  budgets: { maxGzipBytes: 220_000, maxInpMs: 500 },
  shared: [{ name: 'react', range: '^17.0.2' }, { name: 'react-dom', range: '^17.0.2' }],
};
