# ADR 0014: Let a service worker answer one request

Date: 2026-10-31
Status: Accepted

## Context

The request cache on the Data page is a `Map`. The poller and the other tab talk to that map. None of them call `fetch` against this origin, so the Network panel stays empty and the buttons look like they only update the page.

A service worker can intercept a real request. It should not become the catalog cache. [ADR 0013](0013-cross-tab-cache.md) already shares an in-memory entry, and that entry is supposed to disappear on reload.

## Decision

`apps/platform/public/sw.js` handles only URLs whose path ends in `/api/pulse` or `/api/catalog`. Every other request, including the page's JavaScript, is left alone.

The Data page registers the worker and waits until it controls the document. Fetch from the worker sends `{ type: 'platform-mode', mode: 'fresh' }` and waits for the acknowledgement, then calls `fetch`. The worker stores the JSON body in the Cache Storage cache `platform-shell-v1` and returns it with `X-Platform-Source: worker`. The sequence increases by one each time.

Serve the next one from cache sets the mode to `cache` first. The worker returns the stored body and does not increase the sequence. Fail the next one returns HTTP 503 once, then the mode goes back to `fresh`. Clear the worker cache deletes that Cache Storage entry from the page. It does not need the worker to be in control.

The page reads `performance.getEntriesByType('resource')` for the `/api/pulse` entry and shows that duration. If the entry is not there yet, it shows the time spent awaiting `fetch`.

The worker is imported only from the Data page, so the registration code is not in the shell chunk that every page pays for.

## Alternatives rejected

- **The worker as the only catalog cache.** The poller, the generation rule, and the other tab already have a cache. A worker would outlive the tab and add a second set of update rules.
- **Intercepting every request.** A worker that calls `respondWith` for module URLs can swallow the app's own files.
- **Registering it from the shell.** Every page would download the client, and the shared chunk is already close to the Decisions budget.

## Trade-offs

The stored body survives a reload until someone clears the cache. It is not the in-memory pulse, and posting it on the BroadcastChannel would mix two caches. The sequence on this panel and the pulse above it are different numbers on purpose.

The first visit installs the worker. `skipWaiting` and `clients.claim` make it take the page without a second reload in current browsers. If the page still has no controller, the buttons stay disabled and the status line says to reload.

jsdom has no `serviceWorker` and no Cache Storage that this script can drive. The unit tests only check that the panel renders and does not throw. The request itself is checked in a browser.

## Consequences

- The worker file is copied from `public/` into the build, so GitHub Pages serves it next to `index.html`.
- A fetch made before the worker controls the page would hit the dev server or the Pages `404.html` fallback. The page waits for `navigator.serviceWorker.controller`.
- This does not cache the app shell, and it does not make the app work offline.

## Further reading

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage)
- [PerformanceResourceTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming)
