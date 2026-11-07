import { labInpPhases, phaseTotal, dominantPhase } from 'platform-vitals';
import { summarizeMainThread, summarizeRenders, totalBlockingTime, ProfiledRegion, observeLongTasks, sampleFrames, scanBlocking, scanSliced, type LongTask, type RenderSample, type ScanResult } from 'platform-profiler';
import { Button, DocLink, Metric, Panel, WindowedList, mountCost, referenceList } from 'platform-ui';
import { memo, useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';

const spans = Array.from({ length: referenceList.itemCount }, (_, index) => ({
  id: `span-${index}`,
  owner: ['catalog', 'checkout', 'vitals', 'shell'][index % 4] ?? 'shell',
  duration: 4 + (index % 37),
}));

const scanBusyMs = 80;
const scanSlice = 500;

function describeScan(kind: 'Blocking' | 'Sliced', result: ScanResult, ticks: number): string {
  const elapsed = result.elapsedMs.toFixed(0);
  return `${kind} scan visited ${result.visited} spans in ${result.slices} ${result.slices === 1 ? 'slice' : 'slices'}. Checksum ${result.checksum}. Ticks during scan: ${ticks}. Elapsed ${elapsed} ms.`;
}

const preset: LongTask[] = [
  { startTime: 0, duration: 18, attribution: 'shell' },
  { startTime: 40, duration: 90, attribution: 'catalog-render' },
  { startTime: 200, duration: 240, attribution: 'checkout-hydration' },
];

const ProfiledSpans = memo(function ProfiledSpans({
  generation,
  query,
  slowToken,
  onSample,
  onMounted,
  onMatched,
}: {
  generation: number;
  query: string;
  slowToken: number;
  onSample: (sample: RenderSample) => void;
  onMounted: (count: number) => void;
  onMatched: (count: number) => void;
}) {
  const filtered = query
    ? spans.filter((span) => span.owner.includes(query) || span.id.includes(query))
    : spans;
  useEffect(() => {
    onMatched(filtered.length);
  }, [filtered.length, onMatched]);
  return (
    <ProfiledRegion id="span-list" onSample={onSample}>
      <SlowList slowToken={slowToken}>
        <WindowedList
          items={filtered}
          rowHeight={referenceList.rowHeight}
          height={referenceList.viewportHeight}
          getKey={(item) => item.id}
          onRange={(range) => onMounted(range.end - range.start)}
          renderRow={(item, index) => `${String(index).padStart(4, '0')}  ${item.id}  ${item.owner}  ${item.duration} ms`}
        />
      </SlowList>
      <span hidden>{generation}</span>
    </ProfiledRegion>
  );
});

function SlowList({ slowToken, children }: { slowToken: number; children: ReactNode }) {
  const burned = useRef(0);
  if (slowToken !== 0 && slowToken !== burned.current) {
    burned.current = slowToken;
    const start = performance.now();
    while (performance.now() - start < 40) {
      // This render is inside the profiler, so the deferred commit shows up as slow.
    }
  }
  return children;
}

export default function RuntimeScreen() {
  const samples = useRef<RenderSample[]>([]);
  const [tasks, setTasks] = useState<LongTask[]>(preset);
  const [stallMs, setStallMs] = useState('80');
  const [mounted, setMounted] = useState(() => mountCost({
    itemCount: spans.length,
    rowHeight: referenceList.rowHeight,
    viewportHeight: referenceList.viewportHeight,
    scrollTop: referenceList.scrollTop,
  }).mounted);
  const [summary, setSummary] = useState(() => summarizeRenders([]));
  const [generation, setGeneration] = useState(0);
  const [query, setQuery] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [slowToken, setSlowToken] = useState(0);
  const [matched, setMatched] = useState(spans.length);
  const [isPending, startTransition] = useTransition();
  const [observed, setObserved] = useState(0);
  const [scanReport, setScanReport] = useState('No scan yet.');
  const [frameReport, setFrameReport] = useState('No frame sample yet.');
  const [scanning, setScanning] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [ticks, setTicks] = useState(0);
  const ticksRef = useRef(0);
  const alive = useRef(true);
  const [windowedCommit, setWindowedCommit] = useState(0);
  const [fullCommit, setFullCommit] = useState<number | null>(null);
  const [mountingFull, setMountingFull] = useState(false);
  const fullRecorded = useRef(false);
  const onSample = useCallback((sample: RenderSample) => {
    samples.current = [...samples.current.slice(-30), sample];
    setSummary(summarizeRenders(samples.current));
    if (sample.id === 'span-list') setWindowedCommit(sample.actualDuration);
  }, []);
  const onFullSample = useCallback((sample: RenderSample) => {
    if (fullRecorded.current || sample.phase !== 'mount') return;
    fullRecorded.current = true;
    setFullCommit(sample.actualDuration);
    setMountingFull(false);
  }, []);
  const onMounted = useCallback((count: number) => setMounted(count), []);
  const onMatched = useCallback((count: number) => setMatched(count), []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => observeLongTasks(() => {
    setObserved((count) => count + 1);
  }), []);

  function readSpan(index: number): number {
    return spans[index]?.duration ?? 0;
  }

  function finishScan(kind: 'Blocking' | 'Sliced', result: ScanResult, startedTicks: number) {
    if (!alive.current) return;
    setScanning(false);
    setScanReport(describeScan(kind, result, ticksRef.current - startedTicks));
  }

  function scanOnThisTurn() {
    const startedTicks = ticksRef.current;
    setScanning(true);
    const result = scanBlocking(spans.length, readSpan, { busyMs: scanBusyMs });
    finishScan('Blocking', result, startedTicks);
  }

  async function scanAcrossFrames() {
    const startedTicks = ticksRef.current;
    setScanning(true);
    const result = await scanSliced(spans.length, readSpan, {
      sliceSize: scanSlice,
      busyMs: scanBusyMs,
      yield: () => new Promise((resolve) => { setTimeout(resolve, 0); }),
    });
    finishScan('Sliced', result, startedTicks);
  }

  async function sample() {
    setSampling(true);
    const sample = await sampleFrames(30, (callback) => { window.requestAnimationFrame(callback); });
    if (!alive.current) return;
    setSampling(false);
    setFrameReport(`${sample.frames} frames · p95 ${sample.p95Ms.toFixed(1)} ms · slow ${sample.slowFrames}`);
  }

  function countTick() {
    ticksRef.current += 1;
    setTicks(ticksRef.current);
  }

  function onFilter(value: string) {
    const next = value.toLowerCase();
    setQuery(next);
    startTransition(() => setListQuery(next));
  }

  function deferSlowFilter() {
    setQuery('checkout');
    startTransition(() => {
      setListQuery('checkout');
      setSlowToken((value) => value + 1);
    });
  }

  const mainThread = summarizeMainThread(tasks, 5000);

  function stall() {
    const duration = Number(stallMs);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const start = performance.now();
    while (performance.now() - start < duration) {
      // Intentional main-thread stall so the lab can show blocking time.
    }
    const elapsed = performance.now() - start;
    setTasks((current) => [...current, { startTime: start, duration: elapsed, attribution: 'lab-stall' }]);
  }

  return (
    <>
      <header className="screen-head">
        <p className="platform-kicker">Main thread</p>
        <h2>Runtime profile</h2>
        <p className="lede">
          JavaScript and painting share one main thread. If that thread stays busy, a click waits.
          A long task is a stretch of work longer than 50ms. <DocLink href="https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time">Total blocking time</DocLink> keeps the part of each long task after the first 50ms. A React commit, measured with the <DocLink href="https://react.dev/reference/react/Profiler">React Profiler</DocLink>, is a different number: it is how long React spent rendering, not how long the user waited for the click to show up on screen.
          The list at the bottom has 4,000 rows. The page only creates DOM nodes for the rows you can see, plus a few extra above and below.
        </p>
      </header>
      <div className="grid-3">
        <Metric label="Long tasks" value={String(mainThread.longTaskCount)} detail={`Worst ${Math.round(mainThread.worstTaskMs)} ms`} tone={mainThread.longTaskCount > 0 ? 'watch' : 'good'} />
        <Metric label="Blocking time" value={`${Math.round(totalBlockingTime(tasks))} ms`} detail="Clip the task, then subtract 50ms" tone={mainThread.totalBlockingTime > 200 ? 'poor' : 'watch'} />
        <Metric label="Rows mounted" value={String(mounted)} detail={`of ${matched} spans`} tone="good" />
      </div>
      <Panel kicker="Lab" title="Block the main thread">
        <div className="form-grid">
          <label className="platform-field">
            Stall duration (ms)
            <input inputMode="numeric" value={stallMs} onChange={(event) => setStallMs(event.target.value)} />
          </label>
          <Button variant="danger" onClick={stall}>Run stall</Button>
          <Button onClick={() => setGeneration((value) => value + 1)}>Commit a React update</Button>
        </div>
        <p className="status-line">
          React commits {summary.count} · slow {summary.slowCount} · p95 {summary.p95ActualMs.toFixed(1)} ms · over budget {summary.overBudgetMs.toFixed(1)} ms
        </p>
        <p className="status-line">Browser long tasks {observed}. Run stall blocks this thread. The observer reports tasks over 50ms. Blocking time above is the lab formula on the tasks this screen recorded.</p>
      </Panel>
      <Panel kicker="Interaction" title="INP is not the commit">
        <p className="platform-muted">
          The lab click takes {phaseTotal(labInpPhases)} ms from the moment you press until the next paint. The longest slice is {dominantPhase(labInpPhases).label.toLowerCase()}. The React commit on this list is {summary.p95ActualMs.toFixed(1)} ms. That commit is only the rendering work. It does not include the time the click waited, or the time the browser spent painting. <DocLink href="https://web.dev/articles/inp">INP</DocLink> is that full wait.
        </p>
        <table className="platform-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {labInpPhases.map((phase) => (
              <tr key={phase.id}>
                <td>{phase.label}</td>
                <td className="platform-mono">{phase.duration} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel kicker="Concurrent" title="Defer the list">
        <p className="platform-muted">
          Type in the field and the text updates immediately. Filtering 4,000 rows is marked as a <DocLink href="https://react.dev/reference/react/useTransition">transition</DocLink>, so a slow list does not have to freeze the input.
        </p>
        <div className="form-grid">
          <label className="platform-field">
            Filter spans
            <input value={query} onChange={(event) => onFilter(event.target.value)} />
          </label>
          <Button onClick={deferSlowFilter}>Defer a slow filter</Button>
        </div>
        <p className="status-line" role="status">
          {isPending
            ? `Input ${query || 'all'}. List is catching up.`
            : `Input ${query || 'all'}. List ${listQuery || 'all'}.`}
        </p>
      </Panel>
      <Panel kicker="Scheduling" title="Same work, two schedules">
        <p className="platform-muted">
          Both scans add up the same 4,000 durations and then spend 80ms busy. Scan on this turn does that in one go, so a click during it cannot land. Scan across frames splits the 80ms into eight turns and gives the browser a gap between them. Count a tick during that gap.
          The checksum is the same when both scans read the same list. Sample 30 frames uses <DocLink href="https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame">requestAnimationFrame</DocLink> to ask for the next paint 30 times and counts a frame as slow when the gap is over 20ms.
          The long-task count on this page comes from the browser’s <DocLink href="https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming">long tasks</DocLink>.
        </p>
        <div className="button-row">
          <Button onClick={scanOnThisTurn} disabled={scanning || sampling}>Scan on this turn</Button>
          <Button onClick={() => void scanAcrossFrames()} disabled={scanning || sampling}>Scan across frames</Button>
          <Button onClick={countTick}>Count a tick {ticks}</Button>
          <Button onClick={() => void sample()} disabled={scanning || sampling}>Sample 30 frames</Button>
        </div>
        <p className="status-line" role="status">{scanReport}</p>
        <p className="status-line">{frameReport}</p>
      </Panel>
      <Panel kicker="Windowing" title="Span list" action={<span className="platform-mono">p95 commit {summary.p95ActualMs.toFixed(1)} ms</span>}>
        <p className="platform-muted">
          Mount every row once builds all 4,000 rows, records that React commit, and then removes them. The list below stays windowed.
        </p>
        <div className="button-row">
          <Button
            onClick={() => {
              fullRecorded.current = false;
              setMountingFull(true);
            }}
            disabled={mountingFull}
          >
            Mount every row once
          </Button>
        </div>
        <p className="status-line" role="status">
          {fullCommit === null
            ? 'No full mount yet.'
            : `Full list commit ${fullCommit.toFixed(1)} ms for ${spans.length} rows. Windowed list commit ${windowedCommit.toFixed(1)} ms for ${mounted} rows.`}
        </p>
        {mountingFull ? (
          <ProfiledRegion id="full-list" onSample={onFullSample}>
            <div hidden>
              {spans.map((span) => (
                <div key={span.id}>{span.id}</div>
              ))}
            </div>
          </ProfiledRegion>
        ) : null}
        <ProfiledSpans
          generation={generation}
          query={listQuery}
          slowToken={slowToken}
          onSample={onSample}
          onMounted={onMounted}
          onMatched={onMatched}
        />
      </Panel>
    </>
  );
}
