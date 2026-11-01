import { describe, expect, it } from 'vitest';
import { dominantPhase, labInpPhases, labLcpPhases, phaseTotal } from './phases';

describe('phase breakdowns', () => {
  it('sums the lab LCP to 2100ms and aims at resource load', () => {
    expect(phaseTotal(labLcpPhases)).toBe(2100);
    expect(dominantPhase(labLcpPhases).id).toBe('resource-load');
  });

  it('sums the lab INP to 160ms and aims at input delay', () => {
    expect(phaseTotal(labInpPhases)).toBe(160);
    expect(dominantPhase(labInpPhases).id).toBe('input-delay');
  });
});
