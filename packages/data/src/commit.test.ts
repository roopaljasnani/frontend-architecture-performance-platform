import { describe, expect, it } from 'vitest';
import { pairedBus } from './bus';
import { createQueryCache } from './cache';
import { commitOptimistic } from './commit';

describe('commitOptimistic', () => {
  it('keeps the new value when the write succeeds', async () => {
    let current = 'old';
    const result = await commitOptimistic({
      previous: current,
      next: 'new',
      apply: (value) => { current = value; },
      write: async () => {},
    });
    expect(result).toBe('kept');
    expect(current).toBe('new');
  });

  it('puts the previous value back when the write fails', async () => {
    const seen: string[] = [];
    const result = await commitOptimistic({
      previous: 'old',
      next: 'new',
      apply: (value) => seen.push(value),
      write: async () => { throw new Error('rejected'); },
    });
    expect(result).toBe('restored');
    expect(seen).toEqual(['new', 'old']);
  });
});

describe('cache channel', () => {
  it('gives a newer record to the other side and ignores an older one', async () => {
    const { local, remote } = pairedBus<{ label: string }>();
    const origin = createQueryCache<{ label: string }>({
      bus: local,
      fetcher: async () => ({ label: 'from this tab' }),
    });
    const other = createQueryCache<{ label: string }>({
      bus: remote,
      fetcher: async () => { throw new Error('the other side does not fetch'); },
    });
    await origin.fetch('/catalog/pulse');
    expect(other.snapshot('/catalog/pulse')).toMatchObject({
      status: 'fresh',
      data: { label: 'from this tab' },
    });
    local.post({
      key: '/catalog/pulse',
      generation: 0,
      snapshot: { key: '/catalog/pulse', status: 'fresh', data: { label: 'stale' }, error: null },
    });
    expect(other.snapshot('/catalog/pulse').data).toEqual({ label: 'from this tab' });
    origin.close();
    other.close();
  });
});
