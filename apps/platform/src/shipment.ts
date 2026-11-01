import { analyzeBundles, budgetGate, type RouteBundle } from 'platform-bundle-budget';
import {
  evaluateBudgets,
  productionCollectorDefaults,
  rateMetric,
  releaseGate,
  type MetricName,
  type VitalSample,
} from 'platform-vitals';

export interface ShipmentRow {
  routeId: string;
  vitals: string;
  bundle: string;
  verdict: 'Ship' | 'Blocked';
  detail: string;
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

function passing(route: string): VitalSample[] {
  return [
    sample('LCP', 2100, route),
    sample('INP', 160, route),
    sample('CLS', 0.04, route),
  ];
}

function bundle(routeId: string, owner: string, gzipBytes: number): RouteBundle {
  return {
    routeId,
    owner,
    assets: [{ file: `${routeId}.js`, gzipBytes, rawBytes: gzipBytes }],
    packages: [],
  };
}

const scenarios: Array<{ route: RouteBundle; maxGzipBytes: number; samples: VitalSample[] }> = [
  { route: bundle('promo', 'growth', 40_000), maxGzipBytes: 80_000, samples: [] },
  { route: bundle('checkout', 'payments', 188_000), maxGzipBytes: 160_000, samples: passing('/checkout') },
  { route: bundle('catalog', 'design-system', 96_000), maxGzipBytes: 120_000, samples: passing('/catalog') },
];

export function shipmentRows(): ShipmentRow[] {
  return scenarios.map((scenario) => {
    const vitals = evaluateBudgets(scenario.samples, productionCollectorDefaults.budgets);
    const vitalGate = releaseGate(vitals);
    const analysis = analyzeBundles(
      [scenario.route],
      [{ routeId: scenario.route.routeId, maxGzipBytes: scenario.maxGzipBytes }],
    );
    const bundleResult = budgetGate(analysis);
    const vitalReasons = vitalGate.blocking.map((result) => (
      result.status === 'missing' ? `${result.name} missing` : `${result.name} over budget`
    ));
    const bundleReasons = bundleResult.errors.map((finding) => finding.message);
    const ok = vitalGate.ok && bundleResult.ok;
    return {
      routeId: scenario.route.routeId,
      vitals: vitalGate.ok ? 'pass' : vitalReasons.join(', '),
      bundle: bundleResult.ok ? 'pass' : bundleReasons.join(' '),
      verdict: ok ? 'Ship' : 'Blocked',
      detail: ok
        ? 'Lab samples are inside the p75 budgets and the route is inside its gzip budget.'
        : [...vitalReasons, ...bundleReasons].join(' '),
    };
  });
}
