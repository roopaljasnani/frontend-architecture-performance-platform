import { afterEach, describe, expect, it, vi } from 'vitest';
import { cumulativeLayoutShift } from './cls';
import { createCollector, evaluateBudgets, percentile, releaseGate } from './collector';
import { estimateInp } from './inp';
import { attachWebVitals, readNavigationTimings } from './observe';
import { rateMetric } from './rating';
import { normalizeRoute } from './route';

describe('rateMetric', () => {
  it('uses inclusive good thresholds and exclusive poor thresholds', () => {
    expect(rateMetric('LCP', 2500)).toBe('good');
    expect(rateMetric('LCP', 2501)).toBe('needs-improvement');
    expect(rateMetric('LCP', 4000)).toBe('needs-improvement');
    expect(rateMetric('LCP', 4001)).toBe('poor');
    expect(rateMetric('INP', 200)).toBe('good');
    expect(rateMetric('INP', 500)).toBe('needs-improvement');
    expect(rateMetric('CLS', 0.1)).toBe('good');
    expect(rateMetric('CLS', 0.25)).toBe('needs-improvement');
    expect(rateMetric('CLS', 0.26)).toBe('poor');
  });
});

describe('cumulativeLayoutShift', () => {
  it('sums a session and ignores input-driven shifts', () => {
    expect(cumulativeLayoutShift([
      { value: 0.05, startTime: 0, hadRecentInput: false },
      { value: 0.3, startTime: 10, hadRecentInput: true },
      { value: 0.06, startTime: 100, hadRecentInput: false },
    ])).toBeCloseTo(0.11);
  });

  it('keeps the worst session window', () => {
    expect(cumulativeLayoutShift([
      { value: 0.05, startTime: 0, hadRecentInput: false },
      { value: 0.06, startTime: 100, hadRecentInput: false },
      { value: 0.2, startTime: 2000, hadRecentInput: false },
    ])).toBeCloseTo(0.2);
  });

  it('closes a window once a shift lands more than five seconds after it opened', () => {
    const shifts = [0, 900, 1800, 2700, 3600, 4500, 5400].map((startTime) => ({
      value: 0.1,
      startTime,
      hadRecentInput: false,
    }));
    expect(cumulativeLayoutShift(shifts)).toBeCloseTo(0.6);
  });
});

describe('estimateInp', () => {
  it('returns the worst interaction when there are fewer than 50', () => {
    expect(estimateInp([40, 180, 90])).toBe(180);
    expect(estimateInp([])).toBe(0);
  });

  it('returns the high percentile once the sample is large', () => {
    const durations = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(estimateInp(durations)).toBe(98);
  });
});

describe('normalizeRoute', () => {
  it('strips queries and replaces ids', () => {
    expect(normalizeRoute('/orders/42/items?token=secret')).toBe('/orders/:id/items');
    expect(normalizeRoute('/users/550e8400-e29b-41d4-a716-446655440000#profile')).toBe('/users/:id');
    expect(normalizeRoute('/search?q=private')).toBe('/search');
  });
});

describe('collector', () => {
  it('keeps the latest sample per metric and navigation', () => {
    const sent: unknown[] = [];
    const collector = createCollector({
      getRoute: () => '/orders/15?tab=1',
      getModuleId: () => 'checkout',
      clock: () => 1000,
      transport: {
        send: (batch) => {
          sent.push(batch);
        },
      },
    });

    collector.record({ name: 'LCP', value: 3000 });
    collector.record({ name: 'LCP', value: 2100 });
    const snapshot = collector.snapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toMatchObject({
      name: 'LCP',
      value: 2100,
      rating: 'good',
      route: '/orders/:id',
      moduleId: 'checkout',
      timestamp: 1000,
    });
    expect(collector.flush()).toHaveLength(1);
    expect(collector.snapshot()).toHaveLength(0);
    expect(sent).toHaveLength(1);
  });

  it('drops samples outside the sample rate', () => {
    const collector = createCollector({
      getRoute: () => '/',
      sampleRate: 0.1,
      rng: () => 0.99,
    });
    collector.record({ name: 'INP', value: 40 });
    expect(collector.snapshot()).toHaveLength(0);
  });

  it('fails a release when data is missing or over budget', () => {
    const samples = [
      ...[1000, 1800, 2600, 4200].map((value) => ({
        name: 'LCP' as const,
        value,
        rating: rateMetric('LCP', value),
        route: '/',
        navigationId: 'n',
        timestamp: 1,
        source: 'lab' as const,
      })),
    ];
    const results = evaluateBudgets(samples, [
      { name: 'LCP', p75Max: 2500 },
      { name: 'INP', p75Max: 200 },
    ]);
    expect(percentile([1000, 1800, 2600, 4200], 75)).toBe(3000);
    expect(results.find((result) => result.name === 'LCP')?.status).toBe('fail');
    expect(results.find((result) => result.name === 'INP')?.status).toBe('missing');
    expect(releaseGate(results).ok).toBe(false);
  });
});

describe('attachWebVitals', () => {
  const original = globalThis.PerformanceObserver;

  afterEach(() => {
    globalThis.PerformanceObserver = original;
    vi.restoreAllMocks();
  });

  it('records the latest LCP entry and navigation TTFB', () => {
    const observed: Array<{ type: string }> = [];
    class FakeObserver {
      constructor(private readonly callback: PerformanceObserverCallback) {}
      observe(init: { type: string }) {
        observed.push(init);
        if (init.type === 'largest-contentful-paint') {
          this.callback({
            getEntries: () => [
              { name: '', entryType: 'largest-contentful-paint', startTime: 1200, renderTime: 2600, loadTime: 0, duration: 0, toJSON() { return {}; } },
            ],
          } as unknown as PerformanceObserverEntryList, this as unknown as PerformanceObserver);
        }
      }
      disconnect() {}
      takeRecords() { return []; }
    }
    globalThis.PerformanceObserver = FakeObserver as unknown as typeof PerformanceObserver;

    vi.spyOn(performance, 'getEntriesByType').mockImplementation((type: string) => {
      if (type === 'navigation') {
        return [{ responseStart: 420 } as unknown as PerformanceEntry];
      }
      return [];
    });

    const collector = createCollector({ getRoute: () => '/home', clock: () => 5 });
    const subscription = attachWebVitals(collector);
    const names = collector.snapshot().map((sample) => sample.name);
    expect(names).toContain('LCP');
    expect(names).toContain('TTFB');
    expect(collector.snapshot().find((sample) => sample.name === 'LCP')?.value).toBe(2600);
    expect(readNavigationTimings()).toEqual({ ttfb: 420 });
    subscription.markNavigation();
    expect(collector.snapshot()).toHaveLength(0);
    expect(collector.recent().some((sample) => sample.name === 'LCP' && sample.source === 'browser')).toBe(true);
    subscription.stop();
  });

  it('keeps the visit log after a navigation clears the current snapshot', () => {
    const lengths: number[] = [];
    const collector = createCollector({ getRoute: () => '/home' });
    const stop = collector.subscribe(() => lengths.push(collector.recent().length));
    collector.record({ name: 'LCP', value: 2100, source: 'browser' });
    collector.record({ name: 'LCP', value: 2100, source: 'browser' });
    collector.nextNavigation();
    expect(collector.snapshot()).toHaveLength(0);
    expect(collector.recent()).toMatchObject([{ name: 'LCP', value: 2100, source: 'browser' }]);
    expect(lengths).toEqual([1]);
    stop();
  });
});
