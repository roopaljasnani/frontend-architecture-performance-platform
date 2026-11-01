export interface RemoteModuleContract {
  id: string;
  version: string;
  owner: string;
}

export type RemoteFailure = 'timeout' | 'load-error' | 'invalid-contract';

export type RemoteResult<T> =
  | { ok: true; module: T }
  | { ok: false; reason: RemoteFailure; message: string };

export function isRemoteModuleContract(value: unknown): value is RemoteModuleContract {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.version === 'string' && typeof record.owner === 'string';
}

async function defaultLoader(url: string): Promise<unknown> {
  return import(/* @vite-ignore */ url);
}

/**
 * Remote modules are an escape hatch with a timeout and a contract check.
 * A slow or shape-invalid remote degrades the shell instead of hanging it.
 */
export async function loadRemoteModule<T>(options: {
  url: string;
  timeoutMs: number;
  loader?: (url: string) => Promise<unknown>;
  isValid: (value: unknown) => value is T;
}): Promise<RemoteResult<T>> {
  const loader = options.loader ?? defaultLoader;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  const timeout = new Promise<RemoteResult<T>>((resolve) => {
    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({
        ok: false,
        reason: 'timeout',
        message: `Remote module ${options.url} exceeded ${options.timeoutMs}ms`,
      });
    }, options.timeoutMs);
  });

  const attempt = (async (): Promise<RemoteResult<T>> => {
    try {
      const loaded = await loader(options.url);
      if (settled) return { ok: false, reason: 'timeout', message: 'Remote module settled after timeout' };
      if (!options.isValid(loaded)) {
        return {
          ok: false,
          reason: 'invalid-contract',
          message: `Remote module ${options.url} did not satisfy the module contract`,
        };
      }
      return { ok: true, module: loaded };
    } catch (error) {
      return {
        ok: false,
        reason: 'load-error',
        message: error instanceof Error ? error.message : 'Remote module failed to load',
      };
    }
  })();

  const result = await Promise.race([attempt, timeout]);
  settled = true;
  if (timeoutId) clearTimeout(timeoutId);
  return result;
}
