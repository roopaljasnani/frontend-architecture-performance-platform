export interface LongTask {
  startTime: number;
  duration: number;
  attribution?: string;
}

export interface TimeWindow {
  start: number;
  end: number;
}

/**
 * Total blocking time inside a window.
 * The task is clipped to the window first, then the 50ms allowance is removed.
 * This matches the Lighthouse definition used between FCP and TTI. Callers that
 * do not have a reliable TTI pass the navigation window they care about.
 */
export function totalBlockingTime(tasks: readonly LongTask[], window?: TimeWindow): number {
  return tasks.reduce((sum, task) => {
    const taskEnd = task.startTime + task.duration;
    const start = window ? Math.max(task.startTime, window.start) : task.startTime;
    const end = window ? Math.min(taskEnd, window.end) : taskEnd;
    const visible = Math.max(0, end - start);
    return sum + Math.max(0, visible - 50);
  }, 0);
}

export interface MainThreadSummary {
  longTaskCount: number;
  totalBlockingTime: number;
  worstTaskMs: number;
  occupancy: number;
}

export function summarizeMainThread(tasks: readonly LongTask[], windowMs: number): MainThreadSummary {
  const longTasks = tasks.filter((task) => task.duration > 50);
  const busy = tasks.reduce((sum, task) => sum + task.duration, 0);
  return {
    longTaskCount: longTasks.length,
    totalBlockingTime: totalBlockingTime(tasks),
    worstTaskMs: tasks.reduce((worst, task) => Math.max(worst, task.duration), 0),
    occupancy: windowMs <= 0 ? 0 : busy / windowMs,
  };
}
