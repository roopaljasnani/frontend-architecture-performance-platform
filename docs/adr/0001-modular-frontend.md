# ADR 0001: Build-time modular frontend

Date: 2026-10-30
Status: Accepted

## Context

A frontend platform used by more than one team has to ship without turning the client into either a single uncontrolled bundle or a distributed system. The second failure is more common in architecture reviews: micro-frontends are chosen because the org chart is already split, then the runtime pays for that split on every page.

The surfaces here have different owners (platform, performance, accessibility, and a payments example in the bundle fixture). They also share React, tokens, routing chrome, and performance budgets. Those are not independent products.

## Decision

Each area is a module with an id, owner, route, gzip budget, INP budget, and shared dependency ranges. The shell registers modules at build time and loads them with a dynamic import. Shared libraries resolve to one major. A second major fails registration preview.

Code-splitting is still real. Visiting Bundles does not have to evaluate the accessibility screen. The deployable unit is still one shell.

## Alternatives rejected

- **Webpack Module Federation as the default.** Independent deploys look like team autonomy. In practice you take on shared-scope version skew, a runtime single point of failure, and a bundle graph no single CI job can see. Use it only when a surface must deploy on a different cadence and you accept [ADR 0007](0007-remote-modules.md).
- **single-spa or an iframe shell.** Isolation is strong and so is the cost: duplicate frameworks, broken focus order, and layout that the parent cannot budget. Iframes remain a sandbox for untrusted content, not for first-party product UI.
- **One bundle with no module boundary.** Simple until the checkout owner and the design-system owner cannot tell which budget they blew. Ownership needs a name even when the runtime is shared.

## Trade-offs

Teams do not ship the shell on their own cadence. A module change rides the shell pipeline. That is the point. Autonomy is in the code boundary and the owner field, not in a second production runtime.

Dynamic import still fails. The shell treats a rejected load as a visible error with a retry, rather than a blank main.

## Consequences

- `CODEOWNERS` maps packages and screens to owners. Replace the placeholder handles before using the pattern on a real repo.
- Adding a module means adding a budget. An unbudgeted route is a bundle-gate failure, not a follow-up ticket.
- Cross-module state stays in the shell or in an explicit package. Modules do not read each other's internals off `window`.

## Scale and operations

At two teams this is a folder convention. At eight teams it is the thing that keeps shared React and the token pipeline intact. The pressure to "just federate checkout" should be answered with the remote escape hatch's requirements: timeout, contract, owner, and a kill switch. If those are not acceptable, the module stays in the shell.
