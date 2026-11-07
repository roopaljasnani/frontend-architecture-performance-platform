# Testing strategy

Tests are part of the architecture, not a coverage target.

| Layer | What it proves | Where |
| --- | --- | --- |
| Metric math | Threshold edges, CLS windows, INP percentile, route templates, sampling, missing-data gate | `packages/vitals` |
| Bundle gate | Shared chunks are not duplicates. Majors, copies, missing policies, and the healthy fixture | `packages/bundle-budget` |
| Main thread | Blocking time clipping. Commit summaries. Profiler mount sample | `packages/profiler` |
| Accessibility contract | Names, broken fixture, clean fixture, token contrast | `packages/a11y` |
| Design system | Window range. Button name. Meter name. Dialog focus trap and focus return. Only the visible rows mount | `packages/ui` |
| Request cache | Route-template key. Late response ignored. Stale refetch. Abort restores fresh data. A poll skips an overlapping tick, backs off, and pauses while hidden. A paired channel copies a landed entry and ignores an older generation. A failed optimistic write restores the previous value | `packages/data` |
| Scheduling | Blocking and sliced scans share a checksum. A yielded scan accepts a tick. Frame gaps over 20ms count as slow | `packages/profiler` |
| Theme | System, light, and dark. The document attribute and the stored preference follow the choice | `apps/platform` |
| Module policy | Kebab-case ids, duplicate registration, React 17 rejected, remote timeout and contract | `packages/modules` |
| Shell | Every module renders and passes `audit(document)`. A crashed module can retry. A broken chunk can retry. Focus, title, and path follow the module. The labs for remotes, vitals, runtime, and the accessibility fixture are clicked. The top bar shows an import duration. A saved note stays, and a failed save puts the previous note back | `apps/platform` |
| Service worker | The Data page registers `sw.js` and fetches `/api/pulse` once the worker controls the page. The body is stored, can be served again, or can fail once. jsdom has no service worker, so the request is checked in a browser | `apps/platform/public/sw.js` |
| Release decision | Missing vitals block. An over-budget route blocks. A clear route ships | `apps/platform/src/shipment.ts` |
| Second product | Catalog registers on React 18 with the shell, passes contrast, ships a route with lab samples, and blocks a route with none. A React 17 add-on is refused. The runtime list mounts 18 of 4,000 rows | `packages/catalog-product` |
| Build manifest | A screen chunk plus the shell entry, with shared files once. The shell check writes that shared gzip for the Platform page | `packages/bundle-budget`, `scripts/check-shell-budgets.ts` |
| Harness | Kernels stay under a one-second ceiling and write `benchmarks/results.json` | `benchmarks` |

## What we do not pretend to test

- A full WCAG audit. Add axe-core on rendered product routes in the host app.
- Screen readers. Composite widgets still need a manual pass.
- Field INP. The lab records durations. Real INP needs the browser's event timing in production, sampled.
- Visual regression. The reference shell is reviewed in a browser when the UI changes. Screenshot baselines are a product-app decision.

## CI

`.github/workflows/ci.yml` installs, typechecks, tests, and builds the shell. The healthy bundle fixture is an ordinary test, so a broken gate fails the same job as a broken function.

## How to add a module

1. Register it with an owner, route, and budgets.
2. Give every control a real name.
3. Keep heading order intact under the shell's `h1`.
4. Extend the shell test's screen list with the heading name.
5. If the module can render a long collection, window it.
