export interface TimedPhase {
  id: string;
  label: string;
  duration: number;
}

export function phaseTotal(phases: readonly TimedPhase[]): number {
  return phases.reduce((sum, phase) => sum + phase.duration, 0);
}

/** The longest phase is the one a change should aim at. Ties keep the earlier phase. */
export function dominantPhase(phases: readonly TimedPhase[]): TimedPhase {
  if (phases.length === 0) throw new Error('A phase breakdown needs at least one phase');
  return phases.reduce((best, phase) => (phase.duration > best.duration ? phase : best));
}

/** Lab LCP of 2100ms split the way Chrome reports the four LCP phases. */
export const labLcpPhases: readonly TimedPhase[] = [
  { id: 'ttfb', label: 'Time to first byte', duration: 380 },
  { id: 'resource-delay', label: 'Resource load delay', duration: 140 },
  { id: 'resource-load', label: 'Resource load duration', duration: 980 },
  { id: 'render-delay', label: 'Element render delay', duration: 600 },
];

/** Lab INP of 160ms split into input delay, processing, and presentation. */
export const labInpPhases: readonly TimedPhase[] = [
  { id: 'input-delay', label: 'Input delay', duration: 90 },
  { id: 'processing', label: 'Processing duration', duration: 40 },
  { id: 'presentation', label: 'Presentation delay', duration: 30 },
];
