export type PollPhase = 'idle' | 'running' | 'paused' | 'backing-off';

export interface PollSnapshot {
  phase: PollPhase;
  intervalMs: number;
  completed: number;
  skipped: number;
  inFlight: boolean;
  lastError: string | null;
}

export interface Poller {
  start(): void;
  stop(): void;
  kick(): void;
  refresh(): void;
  setHidden(hidden: boolean): void;
  snapshot(): PollSnapshot;
  subscribe(listener: () => void): () => void;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function defaultSchedule(callback: () => void, delayMs: number): () => void {
  const id = setTimeout(callback, delayMs);
  return () => clearTimeout(id);
}

/**
 * One timer, one in-flight request. A tick that lands while a request is open
 * is skipped. An error lengthens the next wait. Hiding the document clears
 * the timer and aborts the request.
 */
export function createPoller(options: {
  intervalMs: number;
  maxIntervalMs?: number;
  backoffFactor?: number;
  getInterval?: () => number;
  run: (signal: AbortSignal) => Promise<void>;
  schedule?: (callback: () => void, delayMs: number) => () => void;
}): Poller {
  const maxIntervalMs = options.maxIntervalMs ?? 4_000;
  const backoffFactor = options.backoffFactor ?? 2;
  const schedule = options.schedule ?? defaultSchedule;
  const listeners = new Set<() => void>();

  let active = false;
  let hidden = false;
  let failures = 0;
  let completed = 0;
  let skipped = 0;
  let inFlight = false;
  let lastError: string | null = null;
  let phase: PollPhase = 'idle';
  let current: AbortController | null = null;
  let cancel: (() => void) | null = null;
  let scheduledDelay = base();
  let published = publish();

  function base(): number {
    const value = options.getInterval?.() ?? options.intervalMs;
    if (!Number.isFinite(value) || value < 50) return 50;
    return value;
  }

  function publish(): PollSnapshot {
    return { phase, intervalMs: scheduledDelay, completed, skipped, inFlight, lastError };
  }

  function emit() {
    published = publish();
    for (const listener of listeners) listener();
  }

  function cancelTimer() {
    cancel?.();
    cancel = null;
  }

  function arm() {
    cancelTimer();
    if (!active || hidden) return;
    cancel = schedule(() => onFire(), scheduledDelay);
  }

  async function finish(controller: AbortController) {
    try {
      await options.run(controller.signal);
      if (controller.signal.aborted || !active) return;
      failures = 0;
      scheduledDelay = base();
      lastError = null;
      completed += 1;
      phase = hidden ? 'paused' : 'running';
    } catch (error) {
      if (controller.signal.aborted || !active || isAbort(error)) return;
      failures += 1;
      scheduledDelay = Math.min(maxIntervalMs, base() * backoffFactor ** failures);
      lastError = error instanceof Error ? error.message : 'Poll failed';
      phase = 'backing-off';
      arm();
    } finally {
      if (current === controller) {
        inFlight = false;
        current = null;
      }
      emit();
    }
  }

  function onFire() {
    if (!active || hidden) return;
    if (inFlight) {
      skipped += 1;
      emit();
      arm();
      return;
    }
    inFlight = true;
    emit();
    arm();
    const controller = new AbortController();
    current = controller;
    void finish(controller);
  }

  return {
    start() {
      if (active) return;
      active = true;
      failures = 0;
      scheduledDelay = base();
      lastError = null;
      phase = hidden ? 'paused' : 'running';
      emit();
      if (!hidden) onFire();
    },
    stop() {
      active = false;
      cancelTimer();
      current?.abort();
      current = null;
      inFlight = false;
      phase = 'idle';
      scheduledDelay = base();
      emit();
    },
    kick() {
      if (!active || hidden) return;
      onFire();
    },
    refresh() {
      if (inFlight || phase === 'backing-off') return;
      const next = base();
      if (next === scheduledDelay) return;
      scheduledDelay = next;
      emit();
    },
    setHidden(next: boolean) {
      hidden = next;
      if (!active) {
        emit();
        return;
      }
      if (next) {
        cancelTimer();
        current?.abort();
        current = null;
        inFlight = false;
        phase = 'paused';
        emit();
        return;
      }
      phase = 'running';
      emit();
      onFire();
    },
    snapshot() {
      return published;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
