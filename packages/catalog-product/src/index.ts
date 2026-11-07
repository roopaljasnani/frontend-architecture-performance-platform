import { contrastRatio, meetsContrast } from 'platform-a11y';
import { analyzeBundles, budgetGate } from 'platform-bundle-budget';
import { claimsFrom, createRegistry, resolveShared, type ModuleContract } from 'platform-modules';
import { themes } from 'platform-tokens';
import { mountCost, referenceList } from 'platform-ui';
import {
  evaluateBudgets,
  productionCollectorDefaults,
  rateMetric,
  releaseGate,
  type MetricName,
  type VitalSample,
} from 'platform-vitals';

const react18 = [
  { name: 'react', range: '^18.3.1' },
  { name: 'react-dom', range: '^18.3.1' },
];

export const catalogModules: ModuleContract[] = [
  {
    id: 'browse',
    version: '1.0.0',
    owner: 'catalog',
    title: 'Browse',
    route: '/browse',
    budgets: { maxGzipBytes: 90_000, maxInpMs: 200 },
    shared: react18,
  },
  {
    id: 'search',
    version: '1.0.0',
    owner: 'catalog',
    title: 'Search',
    route: '/search',
    budgets: { maxGzipBytes: 90_000, maxInpMs: 200 },
    shared: react18,
  },
];

export function catalogRegistry() {
  const registry = createRegistry<{ default: string }>();
  for (const module of catalogModules) {
    registry.register({ ...module, load: async () => ({ default: module.id }) });
  }
  return registry;
}

function sample(name: MetricName, value: number, route: string): VitalSample {
  return {
    name,
    value,
    rating: rateMetric(name, value),
    route,
    navigationId: 'nav_lab',
    timestamp: 0,
    source: 'lab',
  };
}

function ships(module: ModuleContract, samples: VitalSample[], gzipBytes: number): boolean {
  const vitals = releaseGate(evaluateBudgets(samples, productionCollectorDefaults.budgets));
  const bundles = budgetGate(analyzeBundles(
    [{ routeId: module.id, owner: module.owner, assets: [{ file: `${module.id}.js`, gzipBytes, rawBytes: gzipBytes }], packages: [] }],
    [{ routeId: module.id, maxGzipBytes: module.budgets.maxGzipBytes }],
  ));
  return vitals.ok && bundles.ok;
}

export interface AdoptionReport {
  shellModules: number;
  catalogModules: number;
  reactMajor: number | null;
  reactOk: boolean;
  contrastOk: boolean;
  searchShips: boolean;
  browseShips: boolean;
  rowsMounted: number;
  rowsFull: number;
}

export function adoptionReport(shellModules: readonly ModuleContract[]): AdoptionReport {
  const shared = resolveShared(claimsFrom([...shellModules, ...catalogModules]));
  const react = shared.resolved.find((item) => item.name === 'react');
  const contrastOk = (['dark', 'light'] as const).every((name) => {
    const palette = themes[name];
    return meetsContrast(contrastRatio(palette.text, palette.bg));
  });
  const passing = [
    sample('LCP', 2100, '/search'),
    sample('INP', 160, '/search'),
    sample('CLS', 0.04, '/search'),
  ];
  const search = catalogModules[1];
  const browse = catalogModules[0];
  const rows = mountCost({
    itemCount: referenceList.itemCount,
    rowHeight: referenceList.rowHeight,
    viewportHeight: referenceList.viewportHeight,
    scrollTop: referenceList.scrollTop,
  });
  return {
    shellModules: shellModules.length,
    catalogModules: catalogModules.length,
    reactMajor: react?.major ?? null,
    reactOk: shared.ok && react?.major === 18,
    contrastOk,
    searchShips: search ? ships(search, passing, 58_000) : false,
    browseShips: browse ? ships(browse, [], 58_000) : true,
    rowsMounted: rows.mounted,
    rowsFull: rows.full,
  };
}
