import { browserBus, createPoller, createQueryCache, type QuerySnapshot } from 'platform-data';
import { normalizeRoute } from 'platform-vitals';
import { Button, DocLink, Metric, Panel } from 'platform-ui';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { askWorker, clearWorkerCache, controlWorker, pulseUrl, storedRequests, type WorkerMode } from '../worker-client';

interface CatalogRecord {
  label: string;
  sequence?: number;
  takenAt?: number;
  servedBy?: string;
}

interface ScriptedResponse {
  delayMs: number;
  label: string;
  error?: string;
}

const pulseKey = '/catalog/pulse';
const channelName = 'platform-catalog';

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });
  });
}

function clockStamp(ms: number): string {
  return new Date(ms).toISOString().slice(11, 23);
}

async function requestRecord(signal: AbortSignal, input: { kind?: 'pulse'; delay: number; label?: string; fail: boolean }): Promise<CatalogRecord> {
  const url = new URL('api/catalog', document.baseURI);
  if (input.kind === 'pulse') url.searchParams.set('kind', 'pulse');
  url.searchParams.set('delay', String(input.delay));
  if (input.label) url.searchParams.set('label', input.label);
  if (input.fail) url.searchParams.set('fail', '1');
  const response = await fetch(url, { signal, cache: 'no-store' });
  const raw = await response.text();
  let body: CatalogRecord & { error?: string };
  try {
    body = JSON.parse(raw) as CatalogRecord & { error?: string };
  } catch {
    throw new Error('The response was not JSON. Nothing answered this request.');
  }
  if (!response.ok) throw new Error(body.error || 'The request failed.');
  return body;
}

export default function DataScreen() {
  const scripts = useMemo(() => ({ queue: [] as ScriptedResponse[] }), []);
  const pulse = useRef({ sequence: 0, hold: false, fail: false });
  const intervalRef = useRef(300);
  const [intervalInput, setIntervalInput] = useState('300');
  const cache = useMemo(() => createQueryCache<CatalogRecord>({
    normalizeKey: normalizeRoute,
    bus: browserBus<CatalogRecord>(channelName),
    fetcher: async (key, signal) => {
      const scripted = import.meta.env.MODE === 'test';
      if (key === pulseKey) {
        const delay = pulse.current.hold ? 900 : 40;
        const fail = pulse.current.fail;
        pulse.current.hold = false;
        pulse.current.fail = false;
        if (scripted) {
          if (fail) throw new Error('The pulse request failed.');
          await wait(delay, signal);
          pulse.current.sequence += 1;
          return {
            label: `pulse ${pulse.current.sequence}`,
            sequence: pulse.current.sequence,
            takenAt: Date.now(),
          };
        }
        return requestRecord(signal, { kind: 'pulse', delay, fail });
      }
      const script = scripts.queue.shift() ?? { delayMs: 20, label: key };
      if (scripted) {
        await wait(script.delayMs, signal);
        if (script.error) throw new Error(script.error);
        return { label: script.label };
      }
      return requestRecord(signal, { delay: script.delayMs, label: script.label, fail: Boolean(script.error) });
    },
  }), [scripts]);
  const mirror = useMemo(() => createQueryCache<CatalogRecord>({
    normalizeKey: normalizeRoute,
    bus: browserBus<CatalogRecord>(channelName),
    fetcher: async () => {
      throw new Error('The other tab does not fetch.');
    },
  }), []);
  const poller = useMemo(() => createPoller({
    intervalMs: 300,
    getInterval: () => intervalRef.current,
    run: async (signal) => {
      const result = await cache.fetch(pulseKey, signal);
      if (result.snapshot.status === 'error' && result.snapshot.error) {
        throw new Error(result.snapshot.error);
      }
    },
  }), [cache]);
  const [resource, setResource] = useState('/orders/42?token=secret');
  const [shown, setShown] = useState('/orders/:id');
  const [report, setReport] = useState('No request yet.');
  const [hiddenLab, setHiddenLab] = useState(false);
  const [workerState, setWorkerState] = useState('Starting the worker.');
  const [workerReport, setWorkerReport] = useState('No worker request yet.');
  const [workerSequence, setWorkerSequence] = useState('—');
  const [workerSource, setWorkerSource] = useState('—');
  const [stored, setStored] = useState('Nothing stored.');
  const snapshot = useSyncExternalStore(
    cache.subscribe,
    () => cache.snapshot(shown),
    () => cache.snapshot(shown),
  );
  const pulseSnapshot = useSyncExternalStore(
    cache.subscribe,
    () => cache.snapshot(pulseKey),
    () => cache.snapshot(pulseKey),
  );
  const poll = useSyncExternalStore(poller.subscribe, poller.snapshot, poller.snapshot);
  const heard = useSyncExternalStore(
    mirror.subscribe,
    () => mirror.snapshot(pulseKey),
    () => mirror.snapshot(pulseKey),
  );

  useEffect(() => {
    cache.connect();
    mirror.connect();
    return () => {
      poller.stop();
      cache.close();
      mirror.close();
    };
  }, [cache, mirror, poller]);

  useEffect(() => {
    let cancelled = false;
    void controlWorker()
      .then((message) => { if (!cancelled) setWorkerState(message); })
      .catch((error: unknown) => {
        if (!cancelled) setWorkerState(error instanceof Error ? error.message : 'The worker failed to register.');
      });
    return () => { cancelled = true; };
  }, []);

  async function refreshStored() {
    const paths = await storedRequests();
    setStored(paths.length > 0 ? paths.join(', ') : 'Nothing stored.');
  }

  async function requestPulse(mode: WorkerMode) {
    try {
      const controlled = Boolean(navigator.serviceWorker?.controller);
      if (controlled) await askWorker(mode);
      if (!controlled && mode === 'cache') {
        const cache = await caches.open('platform-shell-v1');
        const cached = await cache.match(pulseUrl());
        if (!cached) {
          setWorkerSource('cache');
          setWorkerSequence('—');
          setWorkerReport('Nothing is stored in Cache Storage yet.');
          return;
        }
        const storedBody = await cached.json() as { sequence?: number };
        setWorkerSequence(storedBody.sequence != null ? String(storedBody.sequence) : '—');
        setWorkerSource('cache');
        setWorkerReport(`Served from Cache Storage. No fetch. Sequence stayed at ${storedBody.sequence ?? '—'}.`);
        await refreshStored();
        return;
      }
      const url = new URL(pulseUrl());
      if (!controlled && mode === 'fail') url.searchParams.set('fail', '1');
      const started = performance.now();
      const response = await fetch(url, { cache: 'no-store' });
      const raw = await response.text();
      let body: { sequence?: number; error?: string; servedBy?: string };
      try {
        body = JSON.parse(raw) as { sequence?: number; error?: string; servedBy?: string };
      } catch {
        throw new Error('The response was not JSON. Nothing answered this request.');
      }
      if (!controlled && response.ok) {
        const cache = await caches.open('platform-shell-v1');
        await cache.put(pulseUrl(), new Response(raw, { headers: { 'Content-Type': 'application/json' } }));
      }
      await new Promise((resolve) => { window.setTimeout(resolve, 0); });
      const timing = performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/api/pulse')).at(-1);
      const elapsed = timing ? Math.round(timing.duration) : Math.round(performance.now() - started);
      const source = response.headers.get('X-Platform-Source') ?? body.servedBy ?? 'network';
      setWorkerSequence(body.sequence != null ? String(body.sequence) : '—');
      setWorkerSource(source);
      setWorkerReport(response.ok
        ? `HTTP ${response.status}. Header X-Platform-Source is ${source}. The browser recorded ${elapsed} ms.`
        : `HTTP ${response.status}. ${body.error ?? 'The request failed.'}`);
      await refreshStored();
    } catch (error) {
      setWorkerReport(error instanceof Error ? error.message : 'The request failed.');
    }
  }

  useEffect(() => {
    const apply = () => poller.setHidden(hiddenLab || document.hidden);
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, [hiddenLab, poller]);

  async function run(next: ScriptedResponse[], key = resource): Promise<QuerySnapshot<CatalogRecord>> {
    scripts.queue.push(...next);
    setShown(normalizeRoute(key));
    const result = await cache.fetch(key);
    setReport(result.ignored ? 'Ignored a late response.' : `${result.snapshot.status} · ${result.snapshot.key}`);
    return result.snapshot;
  }

  async function race() {
    const key = resource;
    scripts.queue.push(
      { delayMs: 60, label: 'late order' },
      { delayMs: 10, label: 'current order' },
    );
    setShown(normalizeRoute(key));
    const first = cache.fetch(key);
    const second = cache.fetch(key);
    const results = await Promise.all([first, second]);
    const ignored = results.filter((result) => result.ignored).length;
    const label = results[1]?.snapshot.data?.label ?? 'nothing';
    setReport(`Showing ${label}. Ignored ${ignored} late response.`);
  }

  function onInterval(value: string) {
    setIntervalInput(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 100) {
      intervalRef.current = parsed;
      poller.refresh();
    }
  }

  const tone = snapshot.status === 'error' ? 'poor' : snapshot.status === 'fresh' ? 'good' : snapshot.status === 'stale' ? 'watch' : 'neutral';
  const pulseTone = poll.phase === 'backing-off' ? 'poor' : poll.phase === 'paused' ? 'watch' : poll.phase === 'running' ? 'good' : 'neutral';

  return (
    <>
      <header className="screen-head">
        <p className="platform-kicker">Data</p>
        <h2>Request cache</h2>
        <p className="lede">
          A record is stored under the route pattern, not the full address. `/orders/42?token=secret` is stored as `/orders/:id`, so the token is not part of the key.
          Load, reload, fail, race, and each poll tick call fetch. The delay is how long that request stays open. The cache still decides which response is allowed to land.
          The other tab is a second cache on a <DocLink href="https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel">BroadcastChannel</DocLink>.
          It does not fetch. It shows the sequence from this page. Open this URL in another window and the same numbers show up there.
          The last panel on this page is different: it calls fetch, and a service worker answers.
        </p>
      </header>
      <div className="grid-3">
        <Metric label="Status" value={snapshot.status} detail={snapshot.key} tone={tone} />
        <Metric label="Record" value={snapshot.data?.label ?? '—'} detail={snapshot.error ?? snapshot.data?.servedBy ?? 'No error'} tone={snapshot.error ? 'poor' : 'neutral'} />
        <Metric label="Template" value={normalizeRoute(resource)} detail="Query tokens stay off the key" />
      </div>
      <Panel kicker="Resource" title="Load a record">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void run([{ delayMs: 20, label: 'current order' }]); }}>
          <label className="platform-field">
            Resource
            <input value={resource} onChange={(event) => setResource(event.target.value)} />
          </label>
          <Button variant="primary" type="submit">Load</Button>
          <Button onClick={() => void run([{ delayMs: 40, label: 'refreshed order' }])}>Reload slowly</Button>
          <Button variant="danger" onClick={() => void run([{ delayMs: 10, label: 'unused', error: 'The catalog request failed.' }])}>Fail the request</Button>
        </form>
        <div className="button-row">
          <Button onClick={() => void race()}>Race two responses</Button>
        </div>
        <p className="status-line" role="status">{report}</p>
      </Panel>
      <Panel kicker="Polling" title="Keep a record fresh">
        <p className="platform-muted">
          Start polling. Each tick asks for a new sequence. If a tick arrives while the previous request is still open, that tick is skipped.
          Fail the next poll makes the following request fail, and the wait doubles.
          Hide the tab uses the <DocLink href="https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API">Page Visibility API</DocLink>: the timer stops and the open request is aborted.
          Hold the next response makes one request take longer than the interval, so you can see a skip.
        </p>
        <div className="grid-3">
          <Metric label="Poll" value={poll.phase} detail={`${poll.intervalMs} ms · ${poll.completed} completed · ${poll.skipped} skipped`} tone={pulseTone} />
          <Metric label="Pulse" value={pulseSnapshot.data?.label ?? '—'} detail={pulseSnapshot.data?.takenAt ? clockStamp(pulseSnapshot.data.takenAt) : 'No pulse yet'} />
          <Metric label="In flight" value={poll.inFlight ? 'yes' : 'no'} detail={poll.lastError ?? (hiddenLab ? 'Lab tab is hidden' : 'Tab visibility follows the document')} tone={poll.lastError ? 'poor' : 'neutral'} />
        </div>
        <div className="form-grid">
          <label className="platform-field">
            Poll interval (ms)
            <input inputMode="numeric" value={intervalInput} onChange={(event) => onInterval(event.target.value)} />
          </label>
          <Button variant="primary" onClick={() => poller.start()}>Start polling</Button>
          <Button onClick={() => poller.stop()}>Stop polling</Button>
          <Button onClick={() => poller.kick()} disabled={poll.phase === 'idle' || poll.phase === 'paused'}>Poll again now</Button>
        </div>
        <div className="button-row">
          <Button onClick={() => { pulse.current.hold = true; }}>Hold the next response</Button>
          <Button variant="danger" onClick={() => { pulse.current.fail = true; }}>Fail the next poll</Button>
          <Button onClick={() => setHiddenLab(true)}>Hide the tab</Button>
          <Button onClick={() => setHiddenLab(false)}>Show the tab</Button>
        </div>
      </Panel>
      <Panel kicker="Other tab" title="Same channel, second cache">
        <p className="platform-muted">
          This block does not ask for the pulse itself. It only listens. After you start polling, the number here should match the pulse sequence above.
          Open this same URL in a second window. That window hears the same channel, named {channelName}.
        </p>
        <Metric label="Heard" value={heard.data?.sequence != null ? String(heard.data.sequence) : '—'} detail={heard.data ? 'Same channel, no fetch of its own' : 'No message yet'} />
      </Panel>
      <Panel kicker="Service worker" title="A real request">
        <p className="platform-muted">
          Fetch calls <span className="platform-mono">fetch</span> on <span className="platform-mono">/api/pulse</span>.
          When a <DocLink href="https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API">service worker</DocLink> controls the page, it answers and writes the body into <DocLink href="https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage">Cache Storage</DocLink>.
          Until then, this origin's server answers, and the page stores that body in the same cache.
          Serve the next one from cache returns the stored body and does not send another request.
          The time in the status line is the <DocLink href="https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming">resource timing</DocLink> entry for a request that really left the page.
        </p>
        <p className="status-line">{workerState}</p>
        <div className="grid-3">
          <Metric label="Sequence" value={workerSequence} detail={workerSource} />
          <Metric label="Stored" value={stored === 'Nothing stored.' ? '—' : 'yes'} detail={stored} />
        </div>
        <p className="status-line" role="status">{workerReport}</p>
        <div className="button-row">
          <Button variant="primary" onClick={() => void requestPulse('fresh')}>Fetch from the worker</Button>
          <Button onClick={() => void requestPulse('cache')}>Serve the next one from cache</Button>
          <Button variant="danger" onClick={() => void requestPulse('fail')}>Fail the next one</Button>
          <Button onClick={() => void clearWorkerCache().then(() => refreshStored())}>Clear the worker cache</Button>
        </div>
      </Panel>
    </>
  );
}
