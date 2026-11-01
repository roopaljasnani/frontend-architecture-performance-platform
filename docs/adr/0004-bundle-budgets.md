# ADR 0004: Bundle budgets fail the build

Date: 2026-10-30
Status: Accepted

## Context

Bundle size conversations happen after a route is already slow, and they happen against a screenshot of a treemap. Nobody owns the number. Shared React gets blamed for duplication because the stats file lists it on every route, while a real second copy of lodash hides in two chunk ids.

## Decision

The stats file names routes, assets, packages, and policies.

- Route weight is the sum of that route's asset gzip bytes. Package bytes are not added on top, or shared chunks would be double counted.
- A route without a policy is `MISSING_POLICY` and fails the gate.
- A route over `maxGzipBytes` is `BUDGET_EXCEEDED` and fails the gate.
- A single asset over the asset cap (150 KB gzip in the fixture) is `OVERSIZED_ASSET`, a warning. One file that large invalidates too much cache when it changes.
- Package identity is `name` plus `chunkId`. The same chunk referenced by many routes is one copy. Two chunk ids are waste. Waste is `sum(unique chunk gzip) - max(unique chunk gzip)`.
- Two majors of the same package are `DUPLICATE_MAJOR` and fail the gate. Two copies of the same version are `DUPLICATE_COPY`, a warning.

`budgetGate` fails on errors only. Warnings stay visible so a team can tighten the gate later without changing the analyzer.

The storefront fixture is a teaching failure: checkout is over budget, `checkout.js` is one oversized asset, lodash is copied, date-fns is on two majors, and React is shared. The healthy fixture is what CI expects to pass.

## Alternatives rejected

- **A quarterly spreadsheet.** It is already stale, and it has no owner at merge time.
- **One global max size.** The shell and checkout do not have the same budget, and a global number gives both owners a place to hide.
- **A visualizer as the gate.** Charts explain. They do not fail a pull request.
- **Counting every package mention as a duplicate.** That flags the shared React chunk and trains people to ignore the gate.

## Trade-offs

The stats format is ours. Vite's manifest does not name npm packages or include gzip sizes. CI gzips the built files and maps each screen chunk back to its module, which enforces the route budget for this shell. Duplicate majors still require a stats file that names packages. Both checks run. A guessed package graph from the manifest is not one of them.

Warnings do not block. A team that wants same-version copies to fail can filter `DUPLICATE_COPY` into the gate. Doing that on day one creates noise before the shared vendor chunk exists.

Gzip is the budget unit because it is closer to transfer cost than raw minified size. It is not Brotli, and it is not parse time. Parse and evaluation cost belong to the runtime profiler.

## Consequences

- New routes cannot merge without a policy line.
- Aligning date-fns to one major is a prerequisite to extracting a shared chunk. The error says that, instead of only printing a byte count.
- The reference app shows the failing storefront on purpose. Do not "fix" that screen by raising the checkout budget.

## Scale and operations

Budgets are part of the module contract, reviewed by the owning team and the platform team. Raising a budget is an explicit change to the stats file, visible in review. A 10% grace is not encoded in the gate. If a route needs temporary room, change the policy and write down when it returns.
