import { adoptionReport } from 'platform-catalog';
import { claimsFrom, isRemoteModuleContract, loadRemoteModule, resolveShared, type RemoteResult, type RemoteModuleContract } from 'platform-modules';
import { DocLink, Button, Metric, Panel } from 'platform-ui';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ModuleBoundary } from '../boundary';
import { importTimings, subscribeImports } from '../imports';
import { platformRegistry, rejectedLegacyModule } from '../registry';
import { formatBytes } from 'platform-bundle-budget';

interface ShellWire {
  routes: number;
  sharedGzip: number;
  saved: number;
}

function MaybeCrash({ crash }: { crash: boolean }) {
  if (crash) throw new Error('Checkout module failed while reading route state.');
  return <p>Checkout module is mounted.</p>;
}

export default function Overview() {
  const modules = platformRegistry.list();
  const proposed = resolveShared(claimsFrom([...modules, rejectedLegacyModule]));
  const accepted = resolveShared(claimsFrom(modules));
  const [remote, setRemote] = useState<RemoteResult<RemoteModuleContract> | null>(null);
  const [crash, setCrash] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const adoption = adoptionReport(modules);
  const [shellWire, setShellWire] = useState<ShellWire | null>(null);
  useEffect(() => {
    const url = new URL('shell-wire.json', document.baseURI);
    let cancel = false;
    fetch(url.href)
      .then((response) => (response.ok ? response.json() as Promise<ShellWire> : null))
      .then((data) => {
        if (!cancel && data && typeof data.sharedGzip === 'number' && typeof data.saved === 'number') setShellWire(data);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);
  const timings = useSyncExternalStore(subscribeImports, importTimings, importTimings);
  const timingFor = new Map(timings.map((timing) => [timing.id, timing]));

  async function runRemote(kind: 'valid' | 'slow' | 'invalid') {
    const result = await loadRemoteModule({
      url: `https://cdn.example/${kind}.js`,
      timeoutMs: kind === 'slow' ? 25 : 400,
      isValid: isRemoteModuleContract,
      loader: async () => {
        if (kind === 'slow') return new Promise(() => {});
        if (kind === 'invalid') return { unexpected: true };
        return { id: 'catalog', version: '2.1.0', owner: 'design-system' };
      },
    });
    setRemote(result);
  }

  return (
    <>
      <header className="screen-head">
        <p className="platform-kicker">Module shell</p>
        <h2>Platform map</h2>
        <p className="lede">
          The left rail is the list of pages in this app. Each page is loaded with a <DocLink href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import">dynamic import</DocLink>, and all of them use the same React.
          Focusing a rail button starts that download before the page opens. The HTML way to do the same thing, when the next URL is already known, is a <DocLink href="https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/modulepreload">modulepreload</DocLink> link. This shell uses import() because the page is chosen in JavaScript.
          The time in the top bar is a <DocLink href="https://developer.mozilla.org/en-US/docs/Web/API/Performance/measure">performance.measure</DocLink> of that import.
        </p>
      </header>
      <div className="grid-3">
        <Metric label="Modules" value={String(modules.length)} detail="Build-time composition" />
        <Metric label="Shared React" value={`v${accepted.resolved.find((item) => item.name === 'react')?.major ?? '—'}`} detail="One major, supplied by the shell" tone="good" />
        <Metric label="Rejected candidate" value={proposed.ok ? 'None' : 'React 17'} detail="legacy-checkout fails closed" tone="poor" />
      </div>
      <Panel kicker="Second product" title="Two products, one platform">
        <p className="platform-muted">
          {`The shell registers ${adoption.shellModules} pages. The catalog product registers browse and search. Both ask for React ${adoption.reactMajor}. Both run the token contrast check, the vitals release gate, and the gzip budget. Search has lab samples inside those budgets, so it ships. Browse has no samples, so the gate blocks it.`}
        </p>
        <div className="grid-3">
          <Metric label="Products" value="2" detail="Shell and catalog" tone={adoption.reactOk && adoption.contrastOk ? 'good' : 'poor'} />
          <Metric label="Rows mounted" value={`${adoption.rowsMounted} of ${adoption.rowsFull}`} detail={`${adoption.rowsFull - adoption.rowsMounted} rows stay out of the document`} tone="good" />
          <Metric
            label="Shell chunk, once"
            value={shellWire ? formatBytes(shellWire.saved) : '—'}
            detail={shellWire ? `Saved against counting ${formatBytes(shellWire.sharedGzip)} on every page` : 'Loads shell-wire.json from the last build'}
            tone="good"
          />
        </div>
        <p className="platform-muted">
          {shellWire
            ? `The row count is the runtime list at rest. The last build measured ${formatBytes(shellWire.sharedGzip)} of files that all ${shellWire.routes} pages load. Counting those files on every page, then shipping each file once, is the saving above. It is the build in this repo. It is not a field change in load time.`
            : 'The row count is the runtime list at rest. The shared-file size is shell-wire.json, written by npm run check:build. It is the build in this repo. It is not a field change in load time.'}
        </p>
      </Panel>
      <Panel kicker="While you click" title="What is actually running">
        <ul>
          <li>Focusing a rail page calls <code>import()</code> and records the time with <code>performance.measure</code>. The top bar is that measure.</li>
          <li>A PerformanceObserver is attached for the whole visit. The Vitals page lists what it recorded. Load lab sample does not use that observer. It writes a fixed set.</li>
          <li>Run stall blocks this thread on purpose. The long-task count on Runtime comes from the browser.</li>
          <li>Race, poll, and the other tab go through the request cache. Save puts the note on the page and restores the previous one if the write throws.</li>
          <li>The Data page can also call fetch. A service worker answers /api/pulse and stores the body in Cache Storage. That request shows up in the browser’s resource timing.</li>
          <li>The remote buttons do not call the network. They run the timeout and the shape check against a stand-in.</li>
        </ul>
      </Panel>
      <Panel kicker="Ownership" title="Registered modules">
        <p className="platform-muted">
          Import stays blank until you focus that page in the rail. After that, it is the same duration the top bar shows.
        </p>
        <table className="platform-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>Owner</th>
              <th>Route</th>
              <th>JS budget</th>
              <th>INP budget</th>
              <th>Import</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((module) => (
              <tr key={module.id}>
                <td>{module.title}</td>
                <td>{module.owner}</td>
                <td className="platform-mono">{module.route}</td>
                <td className="platform-mono">{formatBytes(module.budgets.maxGzipBytes)}</td>
                <td className="platform-mono">{module.budgets.maxInpMs} ms</td>
                <td className="platform-mono">
                  {timingFor.has(module.id) ? `${Math.round(timingFor.get(module.id)?.durationMs ?? 0)} ms` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel kicker="Dependency policy" title="Registration preview">
        <p className="platform-muted">
          {`The row below is a module we refuse to register. It asks for React 17. Every registered page asks for React ${accepted.resolved.find((item) => item.name === 'react')?.major ?? 'unknown'}. The check finds ${proposed.conflicts.length} conflicts, so the shell keeps the page out instead of loading two copies of React.`}
        </p>
      </Panel>
      <Panel kicker="Escape hatch" title="Remote load">
        <p className="platform-muted">
          These three buttons do not call the network. They run the checks a remote script would face: a valid result, a script that never answers, and a result with the wrong shape.
        </p>
        <div className="button-row">
          <Button variant="primary" onClick={() => void runRemote('valid')}>Load valid remote</Button>
          <Button onClick={() => void runRemote('slow')}>Load slow remote</Button>
          <Button variant="danger" onClick={() => void runRemote('invalid')}>Load invalid remote</Button>
        </div>
        <p className="status-line" role="status">
          {remote === null && 'No remote requested.'}
          {remote?.ok && `Loaded ${remote.module.id}@${remote.module.version} from ${remote.module.owner}.`}
          {remote && !remote.ok && `${remote.reason}: ${remote.message}`}
        </p>
      </Panel>
      <Panel kicker="Error recovery" title="Module boundary">
        <p className="platform-muted">
          Simulate module crash throws inside this panel. The left rail stays. Retry module renders the panel again.
        </p>
        <div className="button-row">
          <Button variant="danger" onClick={() => setCrash(true)}>Simulate module crash</Button>
        </div>
        <ModuleBoundary
          resetKey={String(epoch)}
          onReset={() => {
            setCrash(false);
            setEpoch((value) => value + 1);
          }}
        >
          <MaybeCrash crash={crash} />
        </ModuleBoundary>
      </Panel>
    </>
  );
}
