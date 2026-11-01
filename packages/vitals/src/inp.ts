/**
 * High-percentile interaction latency.
 * Sort descending and take index min(n - 1, floor(n / 50)).
 * That selects the worst interaction below 50 samples and approximately
 * the 98th percentile after that, matching the web-vitals selection rule.
 */
export function estimateInp(durationsMs: readonly number[]): number {
  if (durationsMs.length === 0) return 0;
  const sorted = [...durationsMs].sort((a, b) => b - a);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length / 50));
  return sorted[index] ?? 0;
}
