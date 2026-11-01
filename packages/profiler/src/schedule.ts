import { percentile } from './renders';

export interface ScanResult {
  visited: number;
  checksum: number;
  elapsedMs: number;
  slices: number;
  aborted: boolean;
}

export interface FrameSample {
  frames: number;
  p95Ms: number;
  slowFrames: number;
}

const slowFrameMs = 20;

function occupy(ms: number, now: () => number) {
  if (ms <= 0) return;
  const start = now();
  while (now() - start < ms) {
    // The slice owns the thread until its share of the budget is gone.
  }
}

function empty(elapsedMs = 0): ScanResult {
  return { visited: 0, checksum: 0, elapsedMs, slices: 0, aborted: false };
}

/** Read every item before returning to the event loop. */
export function scanBlocking(
  count: number,
  read: (index: number) => number,
  options?: { busyMs?: number; now?: () => number },
): ScanResult {
  const now = options?.now ?? (() => performance.now());
  if (count <= 0) return empty();
  const start = now();
  let checksum = 0;
  for (let index = 0; index < count; index += 1) checksum += read(index);
  occupy(options?.busyMs ?? 0, now);
  return { visited: count, checksum, elapsedMs: now() - start, slices: 1, aborted: false };
}

/**
 * The same read, split across turns. `yield` runs between slices so input
 * that arrived during the slice can be handled before the next one.
 */
export async function scanSliced(
  count: number,
  read: (index: number) => number,
  options: {
    sliceSize: number;
    yield: () => Promise<void>;
    busyMs?: number;
    now?: () => number;
    signal?: AbortSignal;
  },
): Promise<ScanResult> {
  const now = options.now ?? (() => performance.now());
  if (count <= 0) return empty();
  const sliceSize = Math.max(1, options.sliceSize);
  const slices = Math.ceil(count / sliceSize);
  const perSlice = (options.busyMs ?? 0) / slices;
  const start = now();
  let checksum = 0;
  let completed = 0;
  for (let index = 0; index < count; index += sliceSize) {
    if (options.signal?.aborted) {
      return { visited: index, checksum, elapsedMs: now() - start, slices: completed, aborted: true };
    }
    const end = Math.min(count, index + sliceSize);
    for (let cursor = index; cursor < end; cursor += 1) checksum += read(cursor);
    occupy(perSlice, now);
    completed += 1;
    if (end < count) await options.yield();
  }
  return { visited: count, checksum, elapsedMs: now() - start, slices: completed, aborted: false };
}

/** A gap over 20ms missed a 60Hz frame. The first callback has no gap. */
export function summarizeFrames(gapsMs: readonly number[]): FrameSample {
  return {
    frames: gapsMs.length,
    p95Ms: percentile(gapsMs, 95),
    slowFrames: gapsMs.filter((gap) => gap > slowFrameMs).length,
  };
}

export function sampleFrames(
  frames: number,
  raf: (callback: (time: number) => void) => void,
): Promise<FrameSample> {
  return new Promise((resolve) => {
    const stamps: number[] = [];
    const needed = Math.max(1, frames) + 1;
    const step = (time: number) => {
      stamps.push(time);
      if (stamps.length >= needed) {
        const gaps = stamps.slice(1).map((stamp, index) => stamp - (stamps[index] ?? stamp));
        resolve(summarizeFrames(gaps));
        return;
      }
      raf(step);
    };
    raf(step);
  });
}
