# ADR 0003: Own the Core Web Vitals math

Date: 2026-10-30
Status: Accepted

## Context

Performance work gets stuck when the only evidence is a vendor chart nobody in the room can recompute. Frontend engineers need to explain LCP, INP, and CLS, attribute them to a route template, and decide what happens when a route has no data.

The browser already measures the raw entries. The platform has to decide the thresholds, the session rules, the identity of a route, and the release rule.

## Decision

`platform-vitals` owns:

- Public thresholds. Good is inclusive. Poor starts strictly above the needs-improvement ceiling. LCP 2500/4000, INP 200/500, CLS 0.1/0.25, FCP 1800/3000, TTFB 800/1800.
- Session-window CLS. Input-driven shifts are ignored. A window breaks on a gap over 1s or a shift more than 5s after the window opened. The score is the worst window.
- INP selection. Sort durations descending and take index `min(n - 1, floor(n / 50))`, the same selection rule as the web-vitals library. INP replaced FID, so FID is not calculated.
- LCP and INP phase sums. The lab splits LCP into time to first byte, resource load delay, resource load duration, and element render delay. It splits INP into input delay, processing, and presentation. The longest phase is the one a change should aim at. A React commit is not the whole interaction.
- Route templates. UUIDs and numeric ids collapse to `:id`. Query strings and hashes are removed before a sample is stored.
- A release gate. A budget with no samples is `missing`, and missing fails the gate. The gate blocks on LCP, INP, and CLS together with the bundle gate. FCP and TTFB are stored and rated, and they do not block a release by themselves. Absence of data is not a pass.

The browser adapter (`attachWebVitals`) is thin. It turns PerformanceObserver entries into samples. Long-lived SPAs call `markNavigation()` on route change so CLS and INP restart. Buffers cap at 500 entries.

Production collector defaults use a 10% sample rate. The reference shell records everything so the lab is explainable.

## Alternatives rejected

- **Vendor dashboards as the definition.** Useful as a transport and a chart. Dangerous as the only implementation, because the team cannot test a rating change or prove that a query string leaked into a dimension.
- **React render counts as a substitute for INP.** Commit duration matters and is measured separately. It is not interaction latency.
- **Raw URLs on the beacon.** Search terms, tokens, and order ids do not belong in metric dimensions.

## Trade-offs

This is a faithful subset, not a byte-for-byte Chrome reimplementation. Long animation frames, interaction grouping edge cases, and full LoAF attribution stay in the browser. The pure functions are what the tests cover.

The release gate will block a brand-new route until lab data or real traffic exists. That is deliberate. Operations must run a lab sample before the first production release of a route. After that, RUM feeds the same evaluator.

Latest-value semantics: LCP, INP, and CLS upsert per navigation. Observer callbacks do not append an unbounded series for a single page view.

## Consequences

- Beacons carry `name`, `value`, `rating`, `route`, `moduleId`, `navigationId`, `timestamp`.
- They do not carry DOM text, full URLs, or input values.
- Sampling is injected (`rng`) so tests do not depend on `Math.random`.

## Scale and operations

p75 over the route template is the SLO: LCP ≤ 2500 ms, INP ≤ 200 ms, CLS ≤ 0.1. Internal and lab traffic can be unsampled. Production beacons default to 10% so the observer and the network are not a tax. A regression hunt can temporarily raise the rate on one route template without changing the math.
