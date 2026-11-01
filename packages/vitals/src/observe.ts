import { cumulativeLayoutShift, type LayoutShift } from './cls';
import type { Collector } from './collector';
import { estimateInp } from './inp';

interface LayoutShiftEntry extends PerformanceEntry {
  value?: number;
  hadRecentInput?: boolean;
}

interface EventTimingEntry extends PerformanceEntry {
  interactionId?: number;
  duration: number;
}

interface LcpEntry extends PerformanceEntry {
  renderTime?: number;
  loadTime?: number;
}

export interface VitalSubscription {
  stop(): void;
  markNavigation(): void;
}

const MAX_BUFFER = 500;

export function readNavigationTimings(perf: Pick<Performance, 'getEntriesByType'> = performance): { ttfb: number } | null {
  const nav = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (!nav || nav.responseStart < 0) return null;
  return { ttfb: nav.responseStart };
}

/**
 * Browser adapter. Metric math stays in pure functions; this file only
 * translates PerformanceObserver entries into collector samples.
 * Long-lived SPAs should call markNavigation() on route change so INP and CLS
 * restart. Buffers are capped so a forgotten listener cannot grow without bound.
 */
export function attachWebVitals(collector: Collector): VitalSubscription {
  const observers: PerformanceObserver[] = [];
  let shifts: LayoutShift[] = [];
  let interactions: number[] = [];

  const safeObserve = (callback: PerformanceObserverCallback, init: PerformanceObserverInit & { durationThreshold?: number }) => {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver(callback);
      observer.observe(init);
      observers.push(observer);
    } catch {
      // Entry type is unsupported in this browser. The collector still accepts lab samples.
    }
  };

  safeObserve((list) => {
    const entries = list.getEntries() as LcpEntry[];
    const last = entries[entries.length - 1];
    if (!last) return;
    collector.record({ name: 'LCP', value: last.renderTime || last.loadTime || last.startTime, source: 'browser' });
  }, { type: 'largest-contentful-paint', buffered: true });

  safeObserve((list) => {
    for (const entry of list.getEntries() as LayoutShiftEntry[]) {
      shifts.push({
        value: entry.value ?? 0,
        startTime: entry.startTime,
        hadRecentInput: Boolean(entry.hadRecentInput),
      });
    }
    if (shifts.length > MAX_BUFFER) shifts = shifts.slice(-MAX_BUFFER);
    collector.record({ name: 'CLS', value: cumulativeLayoutShift(shifts), source: 'browser' });
  }, { type: 'layout-shift', buffered: true });

  safeObserve((list) => {
    for (const entry of list.getEntries() as EventTimingEntry[]) {
      if (!entry.interactionId) continue;
      interactions.push(entry.duration);
    }
    if (interactions.length > MAX_BUFFER) interactions = interactions.slice(-MAX_BUFFER);
    collector.record({ name: 'INP', value: estimateInp(interactions), source: 'browser' });
  }, { type: 'event', buffered: true, durationThreshold: 16 });

  safeObserve((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        collector.record({ name: 'FCP', value: entry.startTime, source: 'browser' });
      }
    }
  }, { type: 'paint', buffered: true });

  const navigation = readNavigationTimings();
  if (navigation) collector.record({ name: 'TTFB', value: navigation.ttfb, source: 'browser' });

  return {
    stop() {
      for (const observer of observers) observer.disconnect();
      observers.length = 0;
    },
    markNavigation() {
      shifts = [];
      interactions = [];
      collector.nextNavigation();
    },
  };
}
