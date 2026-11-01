import { analyzeBundles, budgetGate, formatBytes, storefrontFixture } from 'platform-bundle-budget';
import { BudgetBar, DocLink, Metric, Panel } from 'platform-ui';

export default function BundlesScreen() {
  const analysis = analyzeBundles(storefrontFixture.routes, storefrontFixture.policies, {
    maxAssetGzipBytes: storefrontFixture.maxAssetGzipBytes,
  });
  const gate = budgetGate(analysis);

  return (
    <>
      <header className="screen-head">
        <p className="platform-kicker">CI gate</p>
        <h2>Bundle budgets</h2>
        <p className="lede">
          Every page has a <DocLink href="https://web.dev/articles/performance-budgets-101">size budget</DocLink>. The size is the gzip of the JavaScript that page needs. A file shared by two pages is counted once for each page, but it is still one file on the wire.
          The table below is a made-up storefront that is supposed to fail. Checkout is over its budget, and one library is shipped twice. A unit test runs the same check on a storefront that passes.
          After you build this app, <code>npm run check:build</code> gzips the real output and fails the command if a page is over its budget.
        </p>
      </header>
      <div className="grid-3">
        <Metric label="Gate" value={gate.ok ? 'Pass' : 'Fail'} tone={gate.ok ? 'good' : 'poor'} detail={`${gate.errors.length} blocking findings`} />
        <Metric label="Routes" value={String(analysis.routes.length)} detail="Each route has an owner" />
        <Metric label="Asset cap" value={formatBytes(storefrontFixture.maxAssetGzipBytes)} detail="Split above this size" />
      </div>
      <Panel kicker="Route weight" title="Budgets">
        <div className="platform-stack" style={{ gap: 14 }}>
          {analysis.routes.map((route) => (
            <BudgetBar
              key={route.routeId}
              label={`${route.routeId} · ${route.owner}`}
              value={route.gzipBytes}
              max={route.maxGzipBytes ?? route.gzipBytes}
              format={formatBytes}
            />
          ))}
        </div>
      </Panel>
      <Panel kicker="Findings" title={gate.ok ? 'Nothing blocking' : 'Blocking and warning findings'}>
        {analysis.findings.map((finding) => (
          <article key={`${finding.code}-${finding.routeId ?? finding.packageName}`} className="finding">
            <strong className={finding.severity === 'error' ? 'sev-error' : 'sev-warning'}>{finding.code}</strong>
            <p className="platform-muted">{finding.message}</p>
          </article>
        ))}
      </Panel>
    </>
  );
}
