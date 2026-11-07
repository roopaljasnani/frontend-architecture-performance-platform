# Frontend Architecture & Performance Platform

A small React app that shows how a frontend platform is put together, and the checks that keep it honest.

Preview: [roopaljasnani.github.io/frontend-architecture-performance-platform](https://roopaljasnani.github.io/frontend-architecture-performance-platform/)

There are seven pages. Each one is its own JavaScript file, and all of them use the same React. Open the app, use the rail on the left, and read the paragraph at the top of the page. That paragraph says what the buttons do. The links go to MDN, web.dev, React, or the W3C, where the same idea is documented.

This is a reference app with fixtures. The numbers you see are lab numbers from this repo. They are not production traffic.

## Start here

Run `npm install`, then `npm run dev`, and open `http://localhost:5173`.

| Page | What you are looking at |
| --- | --- |
| Platform | The seven pages, who owns each one, and the size budget. A second product in this repo, catalog, registers browse and search on the same React 18 and the same gates. Search ships on lab samples. Browse has none, so it is blocked. The panel also shows the runtime list mounting 18 of 4,000 rows, and the shared files from the last build, counted once. Tab to a rail item and that page's file starts downloading before you open it. The top bar shows how long the import took. The React 17 row is a module the app refuses to register. The remote buttons do not call the network. They show a timeout and a bad payload. Crash the panel and the rail stays up. |
| Vitals | Largest Contentful Paint, Interaction to Next Paint, and Cumulative Layout Shift. The log at the top is what this browser recorded. Load the lab sample for the fixed release table. Draw 100 production samples and 10 are kept. A route with no samples is blocked. |
| Bundles | A made-up storefront that fails its size budget on purpose. Checkout is too big, and one library is included twice. |
| Runtime | What it costs to block the main thread, how long React spent rendering, and a list of 4,000 rows that only mounts the ones on screen. Mount every row once records that commit and then removes the rows. One scan holds the thread. The other gives it back between slices. |
| Data | A cache keyed by the route pattern, so a token in the query string is not part of the key. Race two responses and the slower one loses. Start polling and the second panel hears the same pulse on a `BroadcastChannel` without fetching it. Open `/data` in another window and that window hears it too. Fetch from the worker calls `fetch` on `/api/pulse`. The service worker stores that body and can serve it again. |
| Accessibility | A short list of checks for names, headings, and contrast. It is not a WCAG audit. Open the route dialog, save a note, and the note stays on the page. Check "Fail this save" and the previous note comes back. |
| Decisions | The choices already made, the options that were turned down, and the cost. Read ADR opens the full note from [`docs/adr`](docs/adr). |

## Read further

- [dynamic import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import) and [`rel=modulepreload`](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/modulepreload)
- [`performance.measure()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measure)
- [Core Web Vitals](https://web.dev/articles/vitals), [LCP](https://web.dev/articles/lcp), [INP](https://web.dev/articles/inp), [CLS](https://web.dev/articles/cls)
- [Performance budgets](https://web.dev/articles/performance-budgets-101)
- [Total blocking time](https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time), [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [long tasks](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming)
- [React Profiler](https://react.dev/reference/react/Profiler) and [`useTransition`](https://react.dev/reference/react/useTransition)
- [`useOptimistic`](https://react.dev/reference/react/useOptimistic) and the [dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel), [Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [Service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [Cache Storage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage), and [resource timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming)
- [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). This app does not prerender. A crawler that does not run JavaScript gets the shell document only.

## What is in the repo

| Area | Where it lives |
| --- | --- |
| Modular frontend. Runtime micro-frontends are not the default | `packages/modules`, [ADR 0001](docs/adr/0001-modular-frontend.md) |
| Design system: names, contrast, windowing | `packages/ui`, `packages/tokens`, `packages/a11y` |
| Core Web Vitals, including route templates that drop query strings | `packages/vitals` |
| Bundle budgets, duplicate majors, shared chunk identity | `packages/bundle-budget` |
| Main-thread blocking time and React commit cost | `packages/profiler` |
| Accessibility checks, and the limit of those checks | `packages/a11y`, [ADR 0006](docs/adr/0006-accessibility-contract.md) |
| Sampling, SLOs, ownership, release gates | [docs/operations.md](docs/operations.md) |

Decisions are in [docs/adr](docs/adr). The worked example is in [docs/case-study.md](docs/case-study.md).

## Docs

Read these in this order. Each one answers a different question.

| Doc | What it is for |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | How the shell and the packages connect, and which package answers which question. |
| [docs/adr](docs/adr) | One file per decision: the context, the choice, what was turned down, and the cost. The Decisions page in the app opens the same file. |
| [docs/operations.md](docs/operations.md) | The numbers a release is held to, what a beacon may contain, and what this reference app does not operate. |
| [docs/testing-strategy.md](docs/testing-strategy.md) | What each test layer proves, and what we do not pretend to test. |
| [docs/scalability.md](docs/scalability.md) | What stays shared as more teams are added, and what should not be split out. |
| [docs/case-study.md](docs/case-study.md) | The lab evidence from this repo. These are not field numbers. |
| [docs/benchmarks.md](docs/benchmarks.md) | How fast the pure checks run. Re-run `npm run bench` before quoting them. |

## Preview

A push to `main` or `master` builds the app and publishes it with GitHub Pages, after the tests pass. The live site is [https://roopaljasnani.github.io/frontend-architecture-performance-platform/](https://roopaljasnani.github.io/frontend-architecture-performance-platform/).

In the repository settings, set Pages to **GitHub Actions**. Deep links such as `/vitals` work because the build also ships `404.html` as a copy of the app. The asset prefix is the repository name, unless the repository is `<user>.github.io`, in which case the site is served from `/`.

`npm run build && npm run preview` serves the same build locally at `/`.

## Run

```bash
npm install
npm test
npm run typecheck
npm run dev
```

The shell is at `http://localhost:5173`.

`npm test` runs the unit tests, the accessibility contract against every screen, and the benchmark harness. The harness writes `benchmarks/results.json` and must stay under a one-second ceiling per kernel. Measured numbers are in [docs/benchmarks.md](docs/benchmarks.md).

`npm run build` writes the shell and a Vite manifest. `npm run check:build` gzips that manifest and fails if a route is over its budget.

## Coverage

| Area | What this repo covers |
| --- | --- |
| Core Web Vitals | LCP, INP, and CLS, including thresholds, session windows, route templates, a browser observer that records the visit, a 10% production draw, and a release block when a sample is missing. |
| Supporting timings | FCP and TTFB are rated and stored. They do not block a release. FID is retired; INP replaced it, and FID is not calculated. |
| Performance | Code-split modules, an import that starts when you focus a rail item, long-task blocking time, React commit cost, a windowed list that mounts 18 of 4,000 rows, one commit of all 4,000 rows beside it, the last build's shared files counted once, a deferred filter, a blocking scan, and the same scan sliced across turns. |
| Scheduling | `requestAnimationFrame` gaps, with a gap over 20ms counted as a missed 60Hz frame. Browser long tasks are counted beside the lab blocking-time formula. |
| Optimization | LCP and INP are split into phases. The longest phase is the change to make. A React commit is not treated as INP. |
| SEO | Document title, path, and canonical follow the module. Tokens stay out of the URL. There is no prerender. A crawler that does not run JavaScript receives the shell document only. |
| Theme | Light and dark share token names. `system` follows the OS. The choice is stored and applied before paint. Both palettes pass the contrast contract. |
| Accessibility | Names, labels, headings, landmarks, contrast, focus on module change, a status announcement, and a dialog focus trap. This is not axe-core and not a screen-reader pass. |
| Data | In-memory cache keyed by route template. Pending, stale, fresh, and error. A late response is ignored. An aborted refetch keeps the previous record. A poll uses that cache: one in-flight request, skip on overlap, backoff on error, pause when the tab is hidden. A `BroadcastChannel` copies a landed entry to another tab. A save paints immediately and restores the previous value if the write fails. A service worker answers `GET /api/pulse`, stores the body, and can serve or fail the next request. |
| Modules and bundling | Build-time registry, one React major, a second product (`packages/catalog-product`) on that same major and the same contrast, vitals, and gzip gates, a remote timeout and contract, a retryable chunk failure, route gzip budgets, duplicate majors on the stats fixture, and a gzip check of this shell's build. |

## Layout

```text
apps/platform        Shell. Build-time modules, one React major.
packages/modules     Registry, shared-major policy, remote escape hatch.
packages/data         Request cache, poller, optimistic write, BroadcastChannel.
packages/ui          Buttons, meters, panels, dialog, windowed lists.
packages/tokens      Color, type, and spacing. Light and dark, both contrast-tested.
packages/vitals      LCP, INP, CLS, FCP, TTFB. Collector, budgets, browser adapter.
packages/bundle-budget   Route budgets, chunk-aware duplicates, CI gate.
packages/profiler    Long-task blocking time, React commits, sliced scans, frame gaps.
packages/a11y        Names, labels, headings, landmarks, contrast.
packages/catalog-product   Second product. Own registry, same React, contrast, and gates.
docs/adr             Decisions, rejected alternatives, trade-offs.
```

## How the shell is put together

A module is an id, an owner, a route, a gzip budget, an INP budget, and the shared libraries it accepts. The shell loads it with a dynamic import. Focusing the rail item starts that import, and the shell records the duration. The shell does not load modules from other origins unless you use the remote path, which times out and checks the shape of the result.

A candidate that asks for React 17 is previewed and refused. The registered modules stay on React 18.

## Scope

This is a reference implementation with a reproducible harness. The storefront bundle fixture is supposed to fail. `fixtures/healthy.stats.json` is the fixture the gate is expected to pass.

The accessibility package does not catch every WCAG failure. [ADR 0006](docs/adr/0006-accessibility-contract.md) says what still needs axe-core and a screen reader.
