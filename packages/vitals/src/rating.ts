export const metricNames = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const;

export type MetricName = (typeof metricNames)[number];
export type Rating = 'good' | 'needs-improvement' | 'poor';

/**
 * Public Core Web Vitals thresholds.
 * Good is inclusive. Poor starts strictly above the second number.
 * https://web.dev/articles/vitals
 */
export const thresholds: Record<MetricName, { good: number; needsImprovement: number }> = {
  LCP: { good: 2500, needsImprovement: 4000 },
  INP: { good: 200, needsImprovement: 500 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

export function rateMetric(name: MetricName, value: number): Rating {
  const band = thresholds[name];
  if (value <= band.good) return 'good';
  if (value <= band.needsImprovement) return 'needs-improvement';
  return 'poor';
}
