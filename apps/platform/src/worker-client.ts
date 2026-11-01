export type WorkerMode = 'fresh' | 'cache' | 'fail';

let inflight: Promise<string> | undefined;

export function pulseUrl(): string {
  return new URL('api/pulse', document.baseURI).toString();
}

export function controlWorker(): Promise<string> {
  if (!('serviceWorker' in navigator)) return Promise.resolve('This browser has no service worker.');
  if (navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js')) {
    return Promise.resolve('The worker is controlling this page.');
  }
  if (!inflight) {
    inflight = startWorker().finally(() => {
      inflight = undefined;
    });
  }
  return inflight;
}

async function startWorker(): Promise<string> {
  const script = new URL('sw.js', document.baseURI).href;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.race([
    Promise.all(registrations.map(async (registration) => {
      if (!registration.active && !registration.waiting && !registration.installing) await registration.unregister();
    })),
    wait(800),
  ]);
  const registration = await Promise.race([
    navigator.serviceWorker.register(script, { updateViaCache: 'none' }),
    wait(3000).then(() => null),
  ]);
  if (!registration) return 'The worker did not finish installing. A fetch still leaves this page.';
  let worker = registration.installing || registration.waiting || registration.active;
  if (!worker) {
    await wait(100);
    worker = registration.installing || registration.waiting || registration.active;
  }
  if (worker && worker.state !== 'activated') {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 4000);
      const finish = () => {
        window.clearTimeout(timer);
        resolve();
      };
      if (worker.state === 'redundant') {
        finish();
        return;
      }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated' || worker.state === 'redundant') finish();
      });
    });
  }
  if (worker?.state === 'redundant') return 'The worker installed and then stopped. Reload the page and try again.';
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 1500);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }
  if (navigator.serviceWorker.controller) return 'The worker is controlling this page.';
  if (registration.active) return 'The worker is installed. Reload the page so it can answer fetches.';
  return 'The worker did not take control of this page. A fetch still leaves this page.';
}

export function askWorker(mode: WorkerMode): Promise<void> {
  const controller = navigator.serviceWorker?.controller;
  if (!controller) return Promise.reject(new Error('The worker is not controlling this page yet.'));
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => reject(new Error('The worker did not answer.')), 1000);
    channel.port1.onmessage = () => {
      window.clearTimeout(timer);
      resolve();
    };
    controller.postMessage({ type: 'platform-mode', mode }, [channel.port2]);
  });
}

export async function storedRequests(): Promise<string[]> {
  if (!('caches' in window)) return [];
  const has = await caches.has('platform-shell-v1');
  if (!has) return [];
  const cache = await caches.open('platform-shell-v1');
  const keys = await cache.keys();
  return keys.map((request) => new URL(request.url).pathname);
}

export async function clearWorkerCache(): Promise<void> {
  if (!('caches' in window)) return;
  await caches.delete('platform-shell-v1');
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
