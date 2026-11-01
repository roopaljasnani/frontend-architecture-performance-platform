import { rateMetric, type MetricName, type Rating } from './rating';
import { normalizeRoute } from './route';

export interface VitalSample {
  name: MetricName;
  value: number;
  rating: Rating;
  route: string;
  moduleId?: string;
  navigationId: string;
  timestamp: number;
  source: 'browser' | 'lab';
}

export interface VitalsTransport {
  send(batch: VitalSample[]): void | Promise<void>;
}

export interface CollectorOptions {
  getRoute: () => string;
  getModuleId?: () => string | undefined;
  transport?: VitalsTransport;
  sampleRate?: number;
  rng?: () => number;
  clock?: () => number;
  createNavigationId?: () => string;
}

export interface Collector {
  record(input: { name: MetricName; value: number; route?: string; moduleId?: string; source?: 'browser' | 'lab' }): void;
  snapshot(): VitalSample[];
  recent(): VitalSample[];
  subscribe(listener: () => void): () => void;
  flush(): VitalSample[];
  nextNavigation(): void;
  navigationId(): string;
}

export function createCollector(options: CollectorOptions): Collector {
  const sampleRate = options.sampleRate ?? 1;
  const rng = options.rng ?? Math.random;
  const clock = options.clock ?? Date.now;
  let sequence = 0;
  const createNavigationId = options.createNavigationId ?? (() => {
    sequence += 1;
    return `nav_${sequence}`;
  });
  let navigationId = createNavigationId();
  const latest = new Map<string, VitalSample>();
  const history: VitalSample[] = [];
  const listeners = new Set<() => void>();
  let recentPublished: VitalSample[] = [];

  function emit() {
    recentPublished = history.slice();
    for (const listener of listeners) listener();
  }

  return {
    navigationId() {
      return navigationId;
    },
    nextNavigation() {
      latest.clear();
      navigationId = createNavigationId();
    },
    record(input) {
      if (rng() >= sampleRate) return;
      const route = normalizeRoute(input.route ?? options.getRoute());
      const moduleId = input.moduleId ?? options.getModuleId?.();
      const sample: VitalSample = {
        name: input.name,
        value: input.value,
        rating: rateMetric(input.name, input.value),
        route,
        moduleId,
        navigationId,
        timestamp: clock(),
        source: input.source ?? 'lab',
      };
      latest.set(`${navigationId}:${input.name}`, sample);
      const index = history.findIndex((item) => item.navigationId === sample.navigationId && item.name === sample.name);
      if (index >= 0) {
        const current = history[index];
        if (current && current.value === sample.value && current.route === sample.route) return;
        history[index] = sample;
      } else {
        history.push(sample);
        if (history.length > 30) history.shift();
      }
      emit();
    },
    snapshot() {
      return [...latest.values()];
    },
    recent() {
      return recentPublished;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flush() {
      const batch = [...latest.values()];
      latest.clear();
      void options.transport?.send(batch);
      return batch;
    },
  };
}

export interface BudgetTarget {
  name: MetricName;
  p75Max: number;
}

export interface BudgetEvaluation {
  name: MetricName;
  status: 'pass' | 'fail' | 'missing';
  p75: number | null;
  limit: number;
  sampleCount: number;
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low] ?? 0;
  const lower = sorted[low] ?? 0;
  const upper = sorted[high] ?? lower;
  return lower + (upper - lower) * (rank - low);
}

export function evaluateBudgets(samples: readonly VitalSample[], budgets: readonly BudgetTarget[]): BudgetEvaluation[] {
  return budgets.map((budget) => {
    const values = samples.filter((sample) => sample.name === budget.name).map((sample) => sample.value);
    if (values.length === 0) {
      return { name: budget.name, status: 'missing', p75: null, limit: budget.p75Max, sampleCount: 0 };
    }
    const p75 = percentile(values, 75);
    return {
      name: budget.name,
      status: p75 <= budget.p75Max ? 'pass' : 'fail',
      p75,
      limit: budget.p75Max,
      sampleCount: values.length,
    };
  });
}

/**
 * A route with no samples does not pass. Lab data or real traffic has to
 * land before a release gate treats the route as healthy.
 */
export function releaseGate(results: readonly BudgetEvaluation[]): { ok: boolean; blocking: BudgetEvaluation[] } {
  const blocking = results.filter((result) => result.status !== 'pass');
  return { ok: blocking.length === 0, blocking };
}

export const productionCollectorDefaults = {
  sampleRate: 0.1,
  budgets: [
    { name: 'LCP' as const, p75Max: 2500 },
    { name: 'INP' as const, p75Max: 200 },
    { name: 'CLS' as const, p75Max: 0.1 },
  ],
};
