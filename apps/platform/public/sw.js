const CACHE = 'platform-shell-v1';
let mode = 'fresh';
let catalogSequence = 0;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'platform-mode' && typeof event.data.mode === 'string') {
    mode = event.data.mode;
    event.ports[0]?.postMessage({ ok: true, mode });
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/api/pulse')) {
    event.respondWith(pulse(storageKey(url)));
    return;
  }
  if (url.pathname.endsWith('/api/catalog')) event.respondWith(catalog(url));
});

async function catalog(url) {
  const delay = Math.min(Number(url.searchParams.get('delay') || 0), 5000);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  const pulseKind = url.searchParams.get('kind') === 'pulse';
  if (url.searchParams.get('fail') === '1') {
    return json({ error: pulseKind ? 'The pulse request failed.' : 'The catalog request failed.' }, 'worker', 503);
  }
  if (pulseKind) {
    catalogSequence += 1;
    return json({
      label: `pulse ${catalogSequence}`,
      sequence: catalogSequence,
      takenAt: Date.now(),
      servedBy: 'worker',
    }, 'worker', 200);
  }
  return json({ label: url.searchParams.get('label') || 'record', servedBy: 'worker' }, 'worker', 200);
}

function storageKey(url) {
  return `${url.origin}/api/pulse`;
}

async function pulse(key) {
  const cache = await caches.open(CACHE);
  if (mode === 'cache') {
    const cached = await cache.match(key);
    if (!cached) {
      return json({ error: 'Nothing is stored in the worker cache yet.' }, 'cache', 404);
    }
    const body = await cached.json();
    return json({ sequence: body.sequence, takenAt: body.takenAt, servedBy: 'cache' }, 'cache', 200);
  }
  if (mode === 'fail') {
    mode = 'fresh';
    return json({ error: 'The worker rejected this request.' }, 'worker', 503);
  }
  const previous = await cache.match(key);
  let sequence = 1;
  if (previous) {
    const old = await previous.json();
    sequence = Number(old.sequence || 0) + 1;
  }
  const body = { sequence, takenAt: Date.now(), servedBy: 'worker' };
  const response = json(body, 'worker', 200);
  await cache.put(key, response.clone());
  return response;
}

function json(body, source, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Platform-Source': source,
    },
  });
}
