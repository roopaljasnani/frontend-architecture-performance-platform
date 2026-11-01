import { formatBytes } from 'platform-bundle-budget';
import {
  createCollector,
  dominantPhase,
  evaluateBudgets,
  labLcpPhases,
  normalizeRoute,
  phaseTotal,
  productionCollectorDefaults,
  type MetricName,
  type VitalSample,
} from 'platform-vitals';
import { Button, DocLink, Metric, Panel } from 'platform-ui';
import { useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useSession } from '../session';
import { shipmentRows } from '../shipment';

const metricOptions: MetricName[] = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
const lcpActions: Record<string, string> = {
  ttfb: 'Server, cache, and redirects.',
  'resource-delay': 'Discover the LCP resource in the first HTML and preload it.',
  'resource-load': 'Shrink the resource or shorten the distance it travels.',
  'render-delay': 'Cut render-blocking work before the element can paint.',
};

function formatVital(sample: VitalSample): string {
  if (sample.name === 'CLS') return sample.value.toFixed(3);
  return `${Math.round(sample.value)} ms`;
}

export default function VitalsScreen() {
  const session = useSession();
  const [samples, setSamples] = useState<VitalSample[]>([]);
  const [metric, setMetric] = useState<MetricName>('LCP');
  const [value, setValue] = useState('2100');
  const [route, setRoute] = useState('/orders/550e8400-e29b-41d4-a716-446655440000?token=secret');
  const [sessions, setSessions] = useState<Array<{ route: string; cls: string; navigationId: string }>>([]);
  const [sampleReport, setSampleReport] = useState('');
  const releases = useMemo(() => shipmentRows(), []);
  const recorded = useSyncExternalStore(session.collector.subscribe, session.collector.recent, session.collector.recent);
  const lcp = phaseTotal(labLcpPhases);
  const slowest = dominantPhase(labLcpPhases);

  const evaluations = useMemo(
    () => evaluateBudgets(samples, productionCollectorDefaults.budgets),
    [samples],
  );

  function refresh() {
    setSamples(session.collector.snapshot());
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    session.collector.record({ name: metric, value: Number(value), route });
    refresh();
  }

  function loadLab() {
    session.collector.nextNavigation();
    session.collector.record({ name: 'LCP', value: 2100, route: '/catalog' });
    session.collector.record({ name: 'INP', value: 160, route: '/catalog' });
    session.collector.record({ name: 'CLS', value: 0.04, route: '/catalog' });
    session.collector.record({ name: 'FCP', value: 1400, route: '/catalog' });
    session.collector.record({ name: 'TTFB', value: 380, route: '/catalog' });
    refresh();
  }

  function splitNavigation() {
    const collector = session.collector;
    collector.nextNavigation();
    collector.record({ name: 'CLS', value: 0.08, route: '/catalog' });
    const catalog = collector.snapshot().find((item) => item.name === 'CLS');
    collector.nextNavigation();
    collector.record({ name: 'CLS', value: 0.02, route: '/checkout' });
    const checkout = collector.snapshot().find((item) => item.name === 'CLS');
    setSessions([
      { route: '/catalog', cls: '0.080', navigationId: catalog?.navigationId ?? '' },
      { route: '/checkout', cls: '0.020', navigationId: checkout?.navigationId ?? '' },
    ]);
    refresh();
  }

  function drawProductionSample() {
    const sent: VitalSample[] = [];
    let draw = 0;
    const probe = createCollector({
      sampleRate: productionCollectorDefaults.sampleRate,
      rng: () => (draw++ % 10 === 0 ? 0 : 1),
      getRoute: () => '/orders/42?token=secret',
      transport: {
        send(batch) {
          sent.push(...batch);
        },
      },
    });
    for (let index = 0; index < 100; index += 1) {
      probe.nextNavigation();
      probe.record({ name: 'INP', value: 180, route: '/orders/42?token=secret' });
      probe.flush();
    }
    const beacon = sent[0]?.route ?? 'none';
    setSampleReport(`Transport received ${sent.length} of 100. Beacon route ${beacon}.`);
  }

  return (
    <>
      <header className="screen-head">
        <p className="platform-kicker">Field and lab</p>
        <h2>Core Web Vitals</h2>
        <p className="lede">
          Google scores a page on three <DocLink href="https://web.dev/articles/vitals">Core Web Vitals</DocLink>. LCP is how long until the largest thing on the screen is visible. INP is how long until the page responds to a click or a key. CLS is how much the layout jumps while you are looking at it.
          FCP and TTFB are recorded too. A release is blocked only when LCP, INP, or CLS is missing or over the limit. FID is an older response metric. INP replaced it, so this app does not calculate FID.
          Load lab sample writes a fixed set, so the release table is the same every time. It does not read this browser. Draw 100 production samples keeps 10 of them. That is the {productionCollectorDefaults.sampleRate * 100}% sample a production build would send.
        </p>
      </header>
      <Panel kicker="This visit" title="Recorded by the browser">
        <p className="platform-muted">
          The app attaches a <DocLink href="https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver">PerformanceObserver</DocLink> when the tab opens, before you press anything on this page. Paint, layout shift, and interaction entries are written into the collector. Each metric keeps its latest value for that navigation. Switching pages starts a new navigation. Load lab sample, below, writes a fixed set and is marked “lab button”.
        </p>
        {recorded.length === 0 ? <p className="platform-muted">Nothing recorded yet. A paint or a click should add a row.</p> : (
          <table className="platform-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>From</th>
                <th>Route</th>
              </tr>
            </thead>
            <tbody>
              {[...recorded].reverse().map((sample, index) => (
                <tr key={`${sample.timestamp}:${sample.navigationId}:${sample.name}:${index}`}>
                  <td>{sample.name}</td>
                  <td className="platform-mono">{formatVital(sample)}</td>
                  <td>{sample.source === 'browser' ? 'this browser' : 'lab button'}</td>
                  <td className="platform-mono">{sample.route}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <div className="button-row">
        <Button variant="primary" onClick={loadLab}>Load lab sample</Button>
      </div>
      <div className="grid-3">
        {productionCollectorDefaults.budgets.map((budget) => {
          const result = evaluations.find((item) => item.name === budget.name);
          const tone = result?.status === 'pass' ? 'good' : result?.status === 'fail' ? 'poor' : 'neutral';
          const shown = result?.p75 === null || result?.p75 === undefined
            ? '—'
            : budget.name === 'CLS'
              ? result.p75.toFixed(3)
              : `${Math.round(result.p75)} ms`;
          return (
            <Metric
              key={budget.name}
              label={`${budget.name} p75`}
              value={shown}
              detail={result ? `${result.status} · limit ${budget.name === 'CLS' ? budget.p75Max : `${budget.p75Max} ms`}` : 'missing'}
              tone={tone}
            />
          );
        })}
      </div>
      <Panel kicker="LCP phases" title={`${lcp} ms, aimed at ${slowest.label}`}>
        <p className="platform-muted">
          The lab page took {lcp} ms to show its largest element. That time splits into four phases. The longest phase is the one worth changing. {lcpActions[slowest.id]} web.dev walks through <DocLink href="https://web.dev/articles/optimize-lcp">how to improve LCP</DocLink> once that phase is known.
        </p>
        <table className="platform-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Duration</th>
              <th>What changes it</th>
            </tr>
          </thead>
          <tbody>
            {labLcpPhases.map((phase) => (
              <tr key={phase.id}>
                <td>{phase.label}</td>
                <td className="platform-mono">{phase.duration} ms</td>
                <td>{lcpActions[phase.id]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel kicker="Release" title="Ship or block">
        <p className="platform-muted">
          A route ships when LCP, INP, and CLS have samples inside their p75 budgets and the gzip gate has no errors.
          Missing samples block the release. FCP and TTFB stay off this decision.
        </p>
        <table className="platform-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Vitals</th>
              <th>Bundle</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((row) => (
              <tr key={row.routeId}>
                <td className="platform-mono">{row.routeId}</td>
                <td>{row.vitals}</td>
                <td>{row.bundle === 'pass' ? 'pass' : row.bundle}</td>
                <td className={row.verdict === 'Ship' ? 'sev-good' : 'sev-error'}>{row.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="status-line">Checkout is {formatBytes(188_000)} over {formatBytes(160_000)}. Catalog is clear. Promo has no samples.</p>
      </Panel>
      <Panel kicker="SPA" title="Navigation reset">
        <p className="platform-muted">
          CLS belongs to one navigation. Closing catalog at 0.080 and opening checkout at 0.020 does not make a 0.100 score.
        </p>
        <Button onClick={splitNavigation}>Close catalog and open checkout</Button>
        {sessions.length > 0 && (
          <p className="status-line" role="status">
            {`Catalog ${sessions[0]?.navigationId} closed at ${sessions[0]?.cls}. Checkout ${sessions[1]?.navigationId} is ${sessions[1]?.cls}, not 0.100.`}
          </p>
        )}
      </Panel>
      <Panel kicker="Sampling" title="Production draw">
        <p className="platform-muted">
          The lab draw keeps every 10th navigation so the count stays reproducible. Production uses the same 10% rate with a random draw.
          Each kept beacon is flushed on its own, because one navigation stores the latest value of each metric.
        </p>
        <Button onClick={drawProductionSample}>Draw 100 production samples</Button>
        {sampleReport ? <p className="status-line" role="status">{sampleReport}</p> : null}
      </Panel>
      <Panel kicker="Lab entry" title="Record a sample">
        <form className="form-grid" onSubmit={onSubmit}>
          <label className="platform-field">
            Metric
            <select value={metric} onChange={(event) => setMetric(event.target.value as MetricName)}>
              {metricOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="platform-field">
            Value
            <input
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <label className="platform-field">
            Route
            <input value={route} onChange={(event) => setRoute(event.target.value)} />
          </label>
          <Button variant="primary" type="submit">Record sample</Button>
        </form>
        <p className="status-line">Beacon route {normalizeRoute(route)}</p>
      </Panel>
      <Panel kicker="Latest navigation" title="Samples">
        {samples.length === 0 ? <p className="platform-muted">No samples yet. Load the lab set or interact with the page.</p> : (
          <table className="platform-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Rating</th>
                <th>Route</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={`${sample.navigationId}:${sample.name}`}>
                  <td>{sample.name}</td>
                  <td className="platform-mono">{formatVital(sample)}</td>
                  <td className={sample.rating === 'good' ? 'sev-good' : sample.rating === 'poor' ? 'sev-error' : 'sev-warning'}>{sample.rating}</td>
                  <td className="platform-mono">{sample.route}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
