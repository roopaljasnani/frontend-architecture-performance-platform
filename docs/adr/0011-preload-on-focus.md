# ADR 0011: Start the download on focus, and time it

Date: 2026-10-31
Status: Accepted

## Context

The rail waits until a click to load the next page. The click then pays for the download and the render together. There is also no record of how long that download took, so a slow page and a slow import look the same.

## Decision

Focusing a rail button, or pressing it, calls the same dynamic `import()` the navigation will use. The first caller owns the promise. A later click reuses it.

The shell records the duration with `performance.now`, and stores a User Timing measure named `module-<id>` from a mark taken at the start. The top bar shows the latest duration. The platform table shows one duration per page, and stays blank until that page has been focused.

Hover does not start a download.

## Alternatives rejected

- **Waiting for the click.** The download and the first render are stacked on the same gesture.
- **A `modulepreload` link for every page in the first HTML.** That fetches pages the person has not asked for. The HTML form is the right tool when the next URL is known up front. Here the next page is chosen in JavaScript.
- **Preload on hover.** Moving the pointer down the rail would fetch every page.

## Trade-offs

A focus that does not become a click still downloads that page. The recorded time is the import. It is not LCP, and it is not INP.

## Consequences

- Retry after a failed import can time the next attempt, because a failure drops the pending promise.
- The timing store lives for the browser tab. A reload starts it over.

## Further reading

- [import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
- [rel=modulepreload](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/modulepreload)
- [Performance.measure()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measure)
