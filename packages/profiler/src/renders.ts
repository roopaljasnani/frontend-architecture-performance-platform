export interface RenderSample {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

export interface RenderSummary {
  count: number;
  slowCount: number;
  p95ActualMs: number;
  totalActualMs: number;
  overBudgetMs: number;
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

/** A commit is slow when it misses a 16ms frame, unless the caller sets another budget. */
export function summarizeRenders(samples: readonly RenderSample[], budgetMs = 16): RenderSummary {
  const actual = samples.map((sample) => sample.actualDuration);
  const totalActualMs = actual.reduce((sum, value) => sum + value, 0);
  const slow = actual.filter((value) => value > budgetMs);
  return {
    count: samples.length,
    slowCount: slow.length,
    p95ActualMs: percentile(actual, 95),
    totalActualMs,
    overBudgetMs: slow.reduce((sum, value) => sum + (value - budgetMs), 0),
  };
}
