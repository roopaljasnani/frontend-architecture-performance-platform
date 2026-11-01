import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPoller } from './poll';

describe('createPoller', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips a tick that lands while a poll is still running', async () => {
    vi.useFakeTimers();
    let started = 0;
    let release: () => void = () => {};
    const poller = createPoller({
      intervalMs: 100,
      run: (signal) => {
        started += 1;
        return new Promise((resolve) => {
          const done = () => resolve();
          signal.addEventListener('abort', done);
          release = done;
        });
      },
    });
    poller.start();
    expect(started).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(poller.snapshot().skipped).toBe(1);
    expect(started).toBe(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.snapshot().completed).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(started).toBe(2);
    poller.stop();
  });

  it('doubles the interval after an error and ignores an abort', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const poller = createPoller({
      intervalMs: 100,
      run: async (signal) => {
        calls += 1;
        if (signal.aborted) return;
        if (calls === 1) throw new Error('down');
      },
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.snapshot()).toMatchObject({ phase: 'backing-off', intervalMs: 200, lastError: 'down', completed: 0 });
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toBe(2);
    expect(poller.snapshot()).toMatchObject({ phase: 'running', completed: 1, intervalMs: 100, lastError: null });
    poller.stop();
  });

  it('pauses and aborts while hidden, then resumes', async () => {
    vi.useFakeTimers();
    let started = 0;
    let aborted = false;
    const poller = createPoller({
      intervalMs: 100,
      run: (signal) => {
        started += 1;
        return new Promise((resolve) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            resolve();
          });
        });
      },
    });
    poller.start();
    poller.setHidden(true);
    expect(aborted).toBe(true);
    expect(poller.snapshot()).toMatchObject({ phase: 'paused', inFlight: false });
    await vi.advanceTimersByTimeAsync(500);
    expect(started).toBe(1);
    poller.setHidden(false);
    expect(started).toBe(2);
    poller.stop();
  });

  it('reads a new interval while idle', () => {
    let interval = 100;
    const poller = createPoller({ intervalMs: 100, getInterval: () => interval, run: async () => {} });
    expect(poller.snapshot().intervalMs).toBe(100);
    interval = 250;
    poller.refresh();
    expect(poller.snapshot().intervalMs).toBe(250);
    poller.stop();
  });
});
