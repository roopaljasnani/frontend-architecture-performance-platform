import { describe, expect, it } from 'vitest';
import { observeLongTasks } from './observe';
import { sampleFrames, scanBlocking, scanSliced, summarizeFrames } from './schedule';

describe('scan scheduling', () => {
  it('returns the same checksum whether the scan yields or not', async () => {
    const read = (index: number) => 4 + (index % 37);
    const blocking = scanBlocking(4000, read);
    const sliced = await scanSliced(4000, read, {
      sliceSize: 500,
      yield: () => Promise.resolve(),
    });
    expect(sliced).toMatchObject({ visited: 4000, slices: 8, checksum: blocking.checksum, aborted: false });
    expect(blocking.slices).toBe(1);
  });

  it('stops between slices when the signal aborts', async () => {
    const controller = new AbortController();
    let slices = 0;
    const result = await scanSliced(10, (index) => index, {
      sliceSize: 4,
      signal: controller.signal,
      yield: () => {
        slices += 1;
        if (slices === 1) controller.abort();
        return Promise.resolve();
      },
    });
    expect(result.aborted).toBe(true);
    expect(result.visited).toBe(4);
  });
});

describe('sampleFrames', () => {
  it('counts a gap over 20ms as a slow frame', () => {
    expect(summarizeFrames([16, 16, 40, 16])).toMatchObject({ frames: 4, slowFrames: 1 });
  });

  it('reads the timestamps the caller provides', async () => {
    const times = [0, 16, 32, 70];
    let cursor = 0;
    const sample = await sampleFrames(3, (callback) => {
      const time = times[cursor] ?? 0;
      cursor += 1;
      callback(time);
    });
    expect(sample).toMatchObject({ frames: 3, slowFrames: 1 });
    expect(sample.p95Ms).toBeGreaterThan(20);
  });
});

describe('observeLongTasks', () => {
  it('returns a disconnect function when the browser has no long-task observer', () => {
    const stop = observeLongTasks(() => {});
    expect(typeof stop).toBe('function');
    stop();
  });
});
