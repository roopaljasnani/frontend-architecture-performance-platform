import { describe, expect, it } from 'vitest';
import { createQueryCache } from './cache';

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('query cache', () => {
  it('normalizes the key and ignores a late response for the same resource', async () => {
    const first = deferred<{ label: string }>();
    const second = deferred<{ label: string }>();
    const pending = [first, second];
    const cache = createQueryCache<{ label: string }>({
      normalizeKey: (key) => key.split('?')[0]?.replace(/\/\d+(?=\/|$)/g, '/:id') ?? key,
      fetcher: () => {
        const next = pending.shift();
        if (!next) throw new Error('missing scripted response');
        return next.promise;
      },
    });

    const slow = cache.fetch('/orders/42?token=secret');
    expect(cache.snapshot('/orders/42?token=secret')).toMatchObject({ key: '/orders/:id', status: 'pending' });
    const current = cache.fetch('/orders/42?token=other');
    second.resolve({ label: 'current order' });
    await expect(current).resolves.toMatchObject({
      ignored: false,
      snapshot: { data: { label: 'current order' }, status: 'fresh' },
    });
    first.resolve({ label: 'late order' });
    await expect(slow).resolves.toMatchObject({ ignored: true });
    expect(cache.snapshot('/orders/:id').data).toEqual({ label: 'current order' });
  });

  it('keeps the previous record visible as stale, then retains it when the refetch fails', async () => {
    const first = deferred<{ label: string }>();
    const second = deferred<{ label: string }>();
    const pending = [first, second];
    const cache = createQueryCache<{ label: string }>({
      fetcher: () => {
        const next = pending.shift();
        if (!next) throw new Error('missing scripted response');
        return next.promise;
      },
    });

    const initial = cache.fetch('/catalog');
    first.resolve({ label: 'catalog' });
    await initial;
    const refetch = cache.fetch('/catalog');
    expect(cache.snapshot('/catalog')).toMatchObject({ status: 'stale', data: { label: 'catalog' } });
    second.reject(new Error('The catalog request failed.'));
    await refetch;
    expect(cache.snapshot('/catalog')).toMatchObject({
      status: 'error',
      data: { label: 'catalog' },
      error: 'The catalog request failed.',
    });
  });

  it('drops an aborted refetch without turning fresh data into an error', async () => {
    let calls = 0;
    const cache = createQueryCache<{ label: string }>({
      fetcher: (_key, signal) => {
        calls += 1;
        if (calls === 1) return Promise.resolve({ label: 'catalog' });
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      },
    });

    await cache.fetch('/catalog');
    const controller = new AbortController();
    const refetch = cache.fetch('/catalog', controller.signal);
    expect(cache.snapshot('/catalog')).toMatchObject({ status: 'stale', data: { label: 'catalog' } });
    controller.abort();
    await refetch;
    expect(cache.snapshot('/catalog')).toMatchObject({ status: 'fresh', data: { label: 'catalog' }, error: null });
  });
});
