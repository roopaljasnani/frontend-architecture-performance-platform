import { describe, expect, it } from 'vitest';
import { shipmentRows } from './shipment';

describe('shipment decision', () => {
  it('blocks a missing sample and an over-budget route, and ships a clear route', () => {
    const rows = shipmentRows();
    expect(rows.find((row) => row.routeId === 'promo')).toMatchObject({
      verdict: 'Blocked',
      vitals: 'LCP missing, INP missing, CLS missing',
      bundle: 'pass',
    });
    expect(rows.find((row) => row.routeId === 'checkout')).toMatchObject({ verdict: 'Blocked' });
    expect(rows.find((row) => row.routeId === 'checkout')?.bundle).toContain('188.0 KB');
    expect(rows.find((row) => row.routeId === 'catalog')).toMatchObject({
      verdict: 'Ship',
      vitals: 'pass',
      bundle: 'pass',
    });
  });
});
