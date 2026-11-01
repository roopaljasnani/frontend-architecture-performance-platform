import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio } from 'platform-a11y';
import { analyzeBundles, type BudgetPolicy, type RouteBundle } from 'platform-bundle-budget';
import { cumulativeLayoutShift, estimateInp } from 'platform-vitals';
import { visibleRange } from 'platform-ui';
import { describe, expect, it } from 'vitest';

function elapsed(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

function routes(count: number): { routes: RouteBundle[]; policies: BudgetPolicy[] } {
  const built = Array.from({ length: count }, (_, index) => ({
    routeId: `route-${index}`,
    owner: `team-${index % 12}`,
    assets: [{ file: `route-${index}.js`, gzipBytes: 40_000 + (index % 20) * 1000, rawBytes: 120_000 }],
    packages: [
      { name: 'react', version: '18.3.1', gzipBytes: 11_000, chunkId: 'vendor-react' },
      {
        name: index % 5 === 0 ? 'date-fns' : 'react-dom',
        version: index % 5 === 0 ? (index % 2 === 0 ? '2.30.0' : '3.6.0') : '18.3.1',
        gzipBytes: 8_000,
        chunkId: index % 5 === 0 ? `date-fns-${index}` : 'vendor-react-dom',
      },
    ],
  }));
  return {
    routes: built,
    policies: built.map((route) => ({ routeId: route.routeId, maxGzipBytes: 80_000 })),
  };
}

describe('performance harness', () => {
  it('measures the platform kernels and records the numbers', () => {
    const graph = routes(300);
    const shifts = Array.from({ length: 10_000 }, (_, index) => ({
      value: 0.001,
      startTime: index * 40,
      hadRecentInput: index % 17 === 0,
    }));
    const interactions = Array.from({ length: 10_000 }, (_, index) => index % 400);

    const results = {
      generatedAt: new Date().toISOString(),
      environment: `node ${process.version}`,
      iterations: {
        analyzeBundles300RoutesMs: elapsed(() => analyzeBundles(graph.routes, graph.policies)),
        estimateInp10kMs: elapsed(() => estimateInp(interactions)),
        cls10kShiftsMs: elapsed(() => cumulativeLayoutShift(shifts)),
        contrast1kPairsMs: elapsed(() => {
          for (let index = 0; index < 1000; index += 1) contrastRatio('#f3efe2', '#10140f');
        }),
        visibleRange100kMs: elapsed(() => {
          for (let index = 0; index < 100_000; index += 1) {
            visibleRange({ itemCount: 4000, rowHeight: 28, viewportHeight: 280, scrollTop: index % 2000 });
          }
        }),
      },
    };

    const directory = path.dirname(fileURLToPath(import.meta.url));
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);

    for (const timing of Object.values(results.iterations)) {
      expect(timing).toBeLessThan(1000);
    }
  });
});
