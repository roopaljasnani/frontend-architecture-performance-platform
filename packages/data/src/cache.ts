import type { CacheBus, CacheUpdate } from './bus';

export type QueryStatus = 'empty' | 'pending' | 'stale' | 'fresh' | 'error';

export interface QuerySnapshot<T> {
  key: string;
  status: QueryStatus;
  data: T | null;
  error: string | null;
}

export interface QueryCache<T> {
  snapshot(key: string): QuerySnapshot<T>;
  fetch(key: string, signal?: AbortSignal): Promise<{ snapshot: QuerySnapshot<T>; ignored: boolean }>;
  subscribe(listener: () => void): () => void;
  connect(): void;
  close(): void;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function blank<T>(key: string): QuerySnapshot<T> {
  return { key, status: 'empty', data: null, error: null };
}

/**
 * One cache entry per normalized key. A newer request wins. A late response
 * for an older request is ignored, including when the caller aborts it.
 * A refetch with data already on screen is stale until the new response lands.
 */
export function createQueryCache<T>(options: {
  fetcher: (key: string, signal: AbortSignal) => Promise<T>;
  normalizeKey?: (key: string) => string;
  bus?: CacheBus<T>;
}): QueryCache<T> {
  const normalizeKey = options.normalizeKey ?? ((key: string) => key);
  const entries = new Map<string, QuerySnapshot<T>>();
  const generations = new Map<string, number>();
  const listeners = new Set<() => void>();
  let stopBus = () => {};

  function isUpdate(message: CacheUpdate<T>): message is CacheUpdate<T> {
    return Boolean(message && typeof message.key === 'string' && typeof message.generation === 'number' && message.snapshot);
  }

  function onBusMessage(message: CacheUpdate<T>) {
    if (!isUpdate(message)) return;
    const current = generations.get(message.key) ?? 0;
    if (message.generation <= current) return;
    generations.set(message.key, message.generation);
    entries.set(message.key, message.snapshot);
    emit();
  }

  function connect() {
    stopBus();
    stopBus = options.bus?.listen(onBusMessage) ?? (() => {});
  }

  function publish(message: CacheUpdate<T>) {
    options.bus?.post(message);
  }

  function emit() {
    for (const listener of listeners) listener();
  }

  function snapshot(rawKey: string): QuerySnapshot<T> {
    const key = normalizeKey(rawKey);
    const existing = entries.get(key);
    if (existing) return existing;
    const empty = blank<T>(key);
    entries.set(key, empty);
    return empty;
  }

  async function fetch(rawKey: string, signal?: AbortSignal): Promise<{ snapshot: QuerySnapshot<T>; ignored: boolean }> {
    const key = normalizeKey(rawKey);
    const generation = (generations.get(key) ?? 0) + 1;
    generations.set(key, generation);
    const previous = entries.get(key);
    const inflight: QuerySnapshot<T> = {
      key,
      status: previous?.data != null ? 'stale' : 'pending',
      data: previous?.data ?? null,
      error: null,
    };
    entries.set(key, inflight);
    emit();

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    try {
      const data = await options.fetcher(key, controller.signal);
      if (generations.get(key) !== generation) {
        return { snapshot: entries.get(key) ?? inflight, ignored: true };
      }
      const fresh: QuerySnapshot<T> = { key, status: 'fresh', data, error: null };
      entries.set(key, fresh);
      emit();
      publish({ key, generation, snapshot: fresh });
      return { snapshot: fresh, ignored: false };
    } catch (error) {
      if (generations.get(key) !== generation) {
        return { snapshot: entries.get(key) ?? inflight, ignored: true };
      }
      if (isAbort(error)) {
        const restored = previous ?? blank<T>(key);
        entries.set(key, restored);
        emit();
        return { snapshot: restored, ignored: false };
      }
      const failed: QuerySnapshot<T> = {
        key,
        status: 'error',
        data: previous?.data ?? null,
        error: error instanceof Error ? error.message : 'Request failed',
      };
      entries.set(key, failed);
      emit();
      publish({ key, generation, snapshot: failed });
      return { snapshot: failed, ignored: false };
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  connect();

  return {
    snapshot,
    fetch,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect,
    close() {
      stopBus();
      stopBus = () => {};
    },
  };
}
