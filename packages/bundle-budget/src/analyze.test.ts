import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyzeBundles, budgetGate, parseBundleStats } from './analyze';
import { healthyFixture, storefrontFixture } from './index';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

describe('parseBundleStats', () => {
  it('reads a stats file from disk', () => {
    const json = readFileSync(path.join(fixtures, 'storefront.stats.json'), 'utf8');
    expect(parseBundleStats(json).routes.map((route) => route.routeId)).toEqual([
      'shell',
      'catalog',
      'vitals',
      'checkout',
    ]);
  });

  it('rejects a file without policies', () => {
    expect(() => parseBundleStats('{"routes":[]}')).toThrow(/policies/);
    expect(() => parseBundleStats('{')).toThrow(/JSON/);
  });
});

describe('analyzeBundles', () => {
  it('flags budget misses, split majors, and copied packages without blaming shared chunks', () => {
    const analysis = analyzeBundles(
      storefrontFixture.routes,
      storefrontFixture.policies,
      { maxAssetGzipBytes: storefrontFixture.maxAssetGzipBytes },
    );
    const gate = budgetGate(analysis);
    expect(gate.ok).toBe(false);
    expect(gate.errors.map((finding) => finding.code).sort()).toEqual(['BUDGET_EXCEEDED', 'DUPLICATE_MAJOR']);
    expect(analysis.findings.some((finding) => finding.code === 'DUPLICATE_COPY' && finding.packageName === 'lodash')).toBe(true);
    expect(analysis.findings.some((finding) => finding.code === 'OVERSIZED_ASSET' && finding.routeId === 'checkout')).toBe(true);
    expect(analysis.duplicatePackages.some((pkg) => pkg.name === 'react')).toBe(false);
    expect(analysis.duplicatePackages.find((pkg) => pkg.name === 'lodash')?.wastedGzipBytes).toBe(24000);
    expect(analysis.routes.find((route) => route.routeId === 'shell')?.gzipBytes).toBe(54000);
  });

  it('passes the healthy fixture used as the CI gate', () => {
    const analysis = analyzeBundles(healthyFixture.routes, healthyFixture.policies, {
      maxAssetGzipBytes: healthyFixture.maxAssetGzipBytes,
    });
    expect(budgetGate(analysis)).toEqual({ ok: true, errors: [] });
  });

  it('treats a route without a policy as a failed gate', () => {
    const analysis = analyzeBundles(healthyFixture.routes, [healthyFixture.policies[0]!], {
      maxAssetGzipBytes: healthyFixture.maxAssetGzipBytes,
    });
    expect(budgetGate(analysis).errors.map((finding) => finding.code)).toEqual(['MISSING_POLICY']);
  });
});
