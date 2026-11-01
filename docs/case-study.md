# A frontend platform with budgets

The numbers below were measured in this repo. They are lab results from the harness and the fixtures, not field traffic.

## Situation

Several teams ship into one React application. Checkout, catalog, and the shell disagree about JavaScript weight. Performance reviews cite a vendor chart. Accessibility depends on whoever remembers to tab through a screen. Architecture discussions jump to micro-frontends because the org chart is already split.

## Constraint

A micro-frontend rollout would make ownership visible and the runtime worse: two Reacts, a bundle graph CI cannot see, and focus order that no longer belongs to one document. A component library without budgets would make the UI more consistent and leave the main thread unchanged.

The useful decision names an owner, a budget, and the alternative that was refused.

## Decision

Keep one shell. Register modules with owners and budgets. Own the vitals math and the bundle gate. Window long lists. Test the accessibility contracts the design system can break. Put remote loading behind a timeout and a contract, and do not make it the default.

The rejected alternatives are in `docs/adr`.

## Evidence

From this repo, on a developer machine:

- The storefront fixture fails the bundle gate for a specific reason: checkout is over 160 KB gzip, `date-fns` is on two majors, and lodash is two chunk ids. React is one shared chunk and is not flagged.
- The healthy fixture passes. That test is the CI gate.
- The shell test opens every module and expects zero contract violations.
- A crashed module retries without taking the rail down with it.
- Query strings do not become route dimensions: `/orders/42/items?token=secret` is stored as `/orders/:id/items`.
- A route with no vitals samples is blocked. A route over its gzip budget is blocked. A route inside both ships.
- Catalog CLS does not add to the next navigation.
- A 10% draw keeps 10 of 100 navigations, and the beacon route drops the token.
- A slower response for the same route template does not replace the newer record.
- A poll that is still running skips the next tick. Hiding the document aborts it, and an error lengthens the next wait.
- The same span checksum comes from a scan that holds the thread and a scan that yields. A tick lands only in the scan that yields.
- Light and dark text pairs both clear the contrast bar. The shell stores the preference and resolves `system` from the OS setting.
- Focusing a rail page starts its import. The shell records that duration.
- The shell attaches a PerformanceObserver for the visit. The vitals page lists the samples it recorded. The lab buttons write a separate fixed set.
- Saving a note paints it immediately. A rejected write puts the previous note back.
- A second cache on the same `BroadcastChannel` shows the pulse without fetching it. An older generation does not replace a newer one.
- Fetch from the worker on the Data page calls `fetch('/api/pulse')`. The service worker stores the body, can serve that same body again, and the browser records a resource timing for the request.
- Harness timings are in [benchmarks.md](benchmarks.md). Regenerate them with `npm run bench`. The built shell is checked with `npm run check:build`.

## Operating rules

- 10% production sampling, 100% in the lab.
- No raw URLs on beacons.
- Missing vitals fail the release of a new route until a lab sample exists.
- Budget increases are diffs.
- axe-core and a screen reader pass stay in place beside the in-repo checks.
