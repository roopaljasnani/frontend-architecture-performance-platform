# ADR 0005: Profile the main thread, not only React

Date: 2026-10-30
Status: Accepted

## Context

Frontend performance work collapses into `memo`, `useMemo`, and a React DevTools screenshot. Those tools miss long tasks that are not React commits: hydration, JSON parsing, synchronous layout, and a loop that "only runs on click."

INP is a field metric. During development we still need a lab model of why the main thread was busy.

## Decision

`platform-profiler` reports two numbers.

**Total blocking time.** Long tasks are clipped to the caller's window, then the 50ms allowance is removed. A 40ms task contributes nothing. An 80ms task contributes 30ms. A task that only partly overlaps the window contributes from the overlap, not from the part outside it. Callers that do not have a reliable Time to Interactive pass the navigation window they actually care about.

**React commits.** `ProfiledRegion` records `actualDuration` from React's Profiler. A commit slower than 16ms is slow unless the caller sets another frame budget. The summary keeps count, p95, and time over budget.

Lists do not render their full data set. `visibleRange` mounts the viewport plus four rows of overscan on each side.

The runtime screen can stall the main thread on purpose. That stall is lab evidence. It is not a production pattern.

## Alternatives rejected

- **Memoization as the strategy.** It reduces some renders. It does not explain a 240ms hydration task, and it adds comparison cost of its own.
- **React DevTools as the only profiler.** Right tool for a local investigation. It is not a number CI or a case study can rerun, and it does not see non-React long tasks.
- **Rendering every row because the API returned every row.** DOM node count becomes the performance bug. Window first, then ask whether the API should have paged.

## Trade-offs

Clip-then-subtract matches the Lighthouse shape and can under-count a task whose first 50ms fell outside the window. The function documents that. It does not try to guess Time to Interactive.

React Profiler callbacks report commit cost, which is not the same as the time the user waited. The case study should not relabel `actualDuration` as INP.

The lab stall is synchronous and obvious. A production profiler must be sampled. An always-on long-task observer on every session is its own main-thread and beacon cost. See operations: default field sampling is 10%.

The same span walk is also scheduled two ways. One scan holds the main thread for the whole budget. The other splits that budget across turns and yields between slices, so an input event can run before the scan finishes. `requestAnimationFrame` gaps are a third number: a gap over 20ms missed a 60Hz frame. `PerformanceObserver` long tasks stay separate from the lab blocking-time formula. The browser's classification and the clipped 50ms formula answer different questions.

## Consequences

- The runtime screen shows mounted row count against 4,000 spans.
- Preset long tasks give the screen a number before anyone clicks. The stall button appends a measured task.
- Frame budget default is 16ms. A screen that animates on the main thread will miss it and should say so.

## Scale and operations

Platform keeps the profiler package. Product modules wrap their heavy regions with an id that matches the module id, so a slow commit can be attributed without a second telemetry taxonomy. Field long tasks, when collected, use the same route template as vitals so they join to LCP and INP without raw URLs.
