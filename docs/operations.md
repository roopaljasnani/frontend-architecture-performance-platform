# Operations

## Service levels

These are route-template SLOs, p75, measured in the field after the release gate has seen at least one lab sample:

| Metric | Budget |
| --- | --- |
| LCP | 2500 ms |
| INP | 200 ms |
| CLS | 0.1 |
| Initial route JavaScript | The module's `maxGzipBytes` |
| Single asset | 150 KB gzip, warning |

A route with no samples does not count as healthy. `releaseGate` treats `missing` as blocking.

## Beacons

Payload fields: metric name, value, rating, route template, module id, navigation id, timestamp.

Never send the raw URL, query string, hash, DOM text, typed input, or customer identifiers. `normalizeRoute` is the last line of defense in the collector, not the only one. Callers should pass a template when they have one.

Sampling: 100% in the lab and on internal builds. 10% in production (`productionCollectorDefaults.sampleRate`). Raise the rate for one route template during an investigation, then put it back. The observer buffer caps at 500 layout shifts and 500 interactions so a forgotten SPA listener cannot grow without bound. Call `markNavigation()` on client-side route changes.

Transport is injected. The reference shell does not phone home.

The shell attaches `attachWebVitals` for the life of the tab. Paint, layout shift, and interaction entries are written into the collector as they happen. The vitals page lists the last 30. Switching modules starts a new navigation, which clears the current snapshot and keeps the log. The lab buttons write a separate fixed set. They do not read the browser.

## Bundle gate

CI runs the analyzer. Errors fail the job: over budget, missing policy, duplicate major. Warnings are printed and do not fail the default gate: oversized asset, same-version duplicate copy.

Raising a budget is a reviewed edit to the stats policy. Do not add a hidden 10% tolerance in the analyzer. The Decisions route was raised from 60 KB to 64 KB gzip because the shared shell now keeps the browser vitals log. The decision notes themselves load as separate files when you open one, so they are not part of that number.

## Ownership

`CODEOWNERS` is illustrative. Platform owns the shell, module runtime, and ADRs. Design system owns tokens and UI. Performance owns vitals, the profiler, and bundle budgets. Accessibility owns the contract package. Product modules own their screens and their screen-reader pass.

## Failure

- Render error: module boundary, message, retry. The rest of the shell stays mounted.
- Load error: the shell shows a load failure and retries the dynamic import. It does not blank the rail. "Simulate a broken chunk" rejects the next load of the current module so that path can be exercised without a network fault.
- Remote timeout or bad contract: a typed result in the screen that asked for the remote. No unbounded wait.
- Kill a remote by not calling `loadRemoteModule`. There is no plugin registry to undeploy at runtime, because remotes are not the default.

## Document

Each module has a path. The shell sets `document.title`, `history.pushState`, and a canonical link to that path. Query tokens are not part of the path. Focus moves to the module heading after the first load, and a status region announces the title.

The document is client-rendered. A crawler that does not run JavaScript receives `index.html`: the description, the title, and an empty root. Per-route titles and canonicals exist after JavaScript runs. There is no prerender and no separate HTML file per route.

## Theme

`platform-theme` is `system`, `light`, or `dark`. `system` follows `prefers-color-scheme`. Both palettes use the same token names and both pass the contrast contract. `index.html` applies the saved choice before the module runs.

## Polling

A poll has one in-flight request. A tick that arrives early is skipped. An error doubles the interval, up to four seconds. A hidden document clears the timer and aborts the request. The cache still drops a late body if one lands. This timer refreshes a record on screen. It is not the vitals beacon, and it still follows the beacon rules if a team later reports it.

## Preload

Focusing or pressing a rail item starts that page's dynamic import. The navigation reuses it. The top bar shows how long the import took. That duration is also a User Timing measure named `module-<id>`. It is not LCP.

## Cross-tab cache

A landed cache entry is posted on a `BroadcastChannel` named `platform-catalog`. Another tab of this origin can show it without fetching. An older generation is ignored. The worker below does not carry these entries.

## Service worker

The Data page calls `fetch` for a catalog record and for each poll tick (`/api/catalog`). It also calls `fetch` on `/api/pulse`. A service worker answers both URLs once it controls the page. Until then, the dev server answers them. The worker stores the `/api/pulse` body in Cache Storage (`platform-shell-v1`), can serve that body again, or can fail the next pulse once. The page shows the resource-timing duration for that URL. Page files are not intercepted. The in-memory cache still chooses which catalog response lands, and the channel is unchanged. jsdom does not run this fetch, so the browser is where it is real.

## What this reference app does not operate

There is no production traffic, no paging policy, and no multi-region story. Those belong to the host application that adopts the packages. The operational decisions above are the ones worth copying: SLO numbers, beacon shape, sampling, and who is allowed to raise a budget.
