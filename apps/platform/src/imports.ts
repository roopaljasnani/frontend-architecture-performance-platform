export interface ImportTiming {
  id: string;
  title: string;
  durationMs: number;
  source: 'focus' | 'navigation';
}

interface TimedModule<T> {
  id: string;
  title: string;
  load: () => Promise<T>;
}

const pending = new Map<string, Promise<unknown>>();
const timings = new Map<string, ImportTiming>();
const listeners = new Set<() => void>();
let published: ImportTiming[] = [];

function emit() {
  published = [...timings.values()];
  for (const listener of listeners) listener();
}

export function importTimings(): ImportTiming[] {
  return published;
}

export function subscribeImports(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Start the dynamic import once, and record how long it took the first time. */
export function loadModule<T>(module: TimedModule<T>, source: 'focus' | 'navigation'): Promise<T> {
  const existing = pending.get(module.id);
  if (existing) return existing as Promise<T>;
  const start = performance.now();
  const mark = `module-${module.id}-start`;
  performance.mark?.(mark);
  const promise = module.load().then((value) => {
    if (!timings.has(module.id)) {
      try {
        performance.measure?.(`module-${module.id}`, mark);
      } catch {
        // The mark can be missing if something else cleared the buffer.
      }
      timings.set(module.id, {
        id: module.id,
        title: module.title,
        durationMs: performance.now() - start,
        source,
      });
      emit();
    }
    return value;
  }, (error: unknown) => {
    pending.delete(module.id);
    throw error;
  });
  pending.set(module.id, promise);
  return promise;
}
