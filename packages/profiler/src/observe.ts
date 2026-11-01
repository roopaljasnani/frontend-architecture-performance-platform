import type { LongTask } from './main-thread';

/** Browser long tasks, separate from the lab formula. Unsupported observers are a no-op. */
export function observeLongTasks(onTask: (task: LongTask) => void): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => {};
  let observer: PerformanceObserver;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration <= 50) continue;
        onTask({ startTime: entry.startTime, duration: entry.duration, attribution: 'longtask' });
      }
    });
    observer.observe({ type: 'longtask', buffered: false } as PerformanceObserverInit);
  } catch {
    return () => {};
  }
  return () => observer.disconnect();
}
