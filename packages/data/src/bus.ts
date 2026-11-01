import type { QuerySnapshot } from './cache';

export interface CacheUpdate<T> {
  key: string;
  generation: number;
  snapshot: QuerySnapshot<T>;
}

export interface CacheBus<T> {
  post(message: CacheUpdate<T>): void;
  listen(onMessage: (message: CacheUpdate<T>) => void): () => void;
  close(): void;
}

/** Two ends of one pipe. A post on one side is delivered to the other. */
export function pairedBus<T>(): { local: CacheBus<T>; remote: CacheBus<T> } {
  const localListeners = new Set<(message: CacheUpdate<T>) => void>();
  const remoteListeners = new Set<(message: CacheUpdate<T>) => void>();
  function side(
    own: Set<(message: CacheUpdate<T>) => void>,
    other: Set<(message: CacheUpdate<T>) => void>,
  ): CacheBus<T> {
    return {
      post(message) {
        for (const listener of other) listener(message);
      },
      listen(onMessage) {
        own.add(onMessage);
        return () => own.delete(onMessage);
      },
      close() {
        own.clear();
      },
    };
  }
  return {
    local: side(localListeners, remoteListeners),
    remote: side(remoteListeners, localListeners),
  };
}

/**
 * The browser channel. A message is delivered to every other BroadcastChannel
 * of the same name, including a second one in this tab, and not back to the sender.
 */
export function browserBus<T>(name: string): CacheBus<T> | undefined {
  if (typeof BroadcastChannel === 'undefined') return undefined;
  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel(name);
  } catch {
    return undefined;
  }
  return {
    post(message) {
      channel.postMessage(message);
    },
    listen(onMessage) {
      const handler = (event: MessageEvent<CacheUpdate<T>>) => onMessage(event.data);
      channel.addEventListener('message', handler);
      return () => channel.removeEventListener('message', handler);
    },
    close() {
      channel.close();
    },
  };
}
