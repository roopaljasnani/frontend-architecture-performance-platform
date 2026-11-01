# ADR 0002: Design system as a contract

Date: 2026-10-30
Status: Accepted

## Context

A shared React library can make a product look consistent and still be the reason INP and accessibility regress. The usual library accumulates components faster than it accumulates rules. Call sites invent their own buttons, their own lists of 4,000 rows, and their own unlabeled icon buttons.

## Decision

`platform-ui` stays small. Components expose accessible names by default. Lists that can grow use `visibleRange` and mount the viewport plus overscan. Color tokens used for text are checked against WCAG AA contrast in tests. A component that cannot meet that bar does not get added to the package.

Tokens are the theming boundary. Components consume those tokens. They do not invent a second palette in JavaScript.

## Alternatives rejected

- **A large kit with no budgets.** Coverage feels like progress. The platform cannot review every new prop combination, and the bundle grows by convenience.
- **Utility CSS as the only shared layer.** It shares appearance and leaves behavior, keyboard handling, and windowing to every app. Those are the parts that break in production.
- **CSS-in-JS as the platform boundary.** Runtime style generation is an extra main-thread cost and a cache-invalidation story the bundle gate cannot see cleanly. Tokens compiled to CSS variables are enough for this platform.

## Trade-offs

The catalog will look incomplete next to a commercial kit. That is acceptable. A new component has to arrive with a name, a keyboard path, and a render-cost story.

Windowing is a pure range plus a thin React list. It is not a virtualization framework. Variable row heights are out of scope until a screen needs them. Adding them later means changing `visibleRange`, not sprinkling `memo` through the list.

## Consequences

- Text and background pairs live in `platform-tokens` and are asserted from `platform-a11y`.
- The shell test renders every module and runs the accessibility contract. A button without a name fails CI.
- 4,000 spans on the runtime screen mount a window, not the full collection.

## Scale and operations

Token changes are platform-owned. Product teams consume them. A local override is a fork: it will fail contrast review or drift from the shell. Document the exception in the module's owner notes rather than hiding a second palette in a screen.

Light and dark use the same token names. `cssVariables()` emits both, and `data-theme` on the document selects one. An explicit choice is stored as `platform-theme`. `system` follows `prefers-color-scheme`. Text pairs in both palettes are part of the contrast test. The shell sets the attribute from `index.html` before paint, then again from React.
