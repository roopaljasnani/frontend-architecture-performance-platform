# ADR 0013: Tell the other tab when a record lands

Date: 2026-10-31
Status: Accepted

## Context

The request cache is a `Map` in the page that created it. A second tab of the same app fetches again, or shows nothing, even when this tab already has the record. A service worker can share a cache, and it is the wrong tool for a value that should disappear on reload.

## Decision

When a fetch lands as fresh or as an error, the cache posts `{ key, generation, snapshot }` on a `BroadcastChannel`. Another cache with the same channel name applies the message when `generation` is newer than what it has. It does not post that message onward.

The data page opens two caches on `platform-catalog`. The second one throws if it is asked to fetch. Its only job is to show what the first one published. A second browser window on `/data` uses the same channel name, so it sees the same pulse.

The generation rule from [ADR 0008](0008-request-cache.md) still applies. An older message cannot replace a newer record. An aborted fetch is not published, because the previous snapshot was restored locally and was already published when it first landed.

Closing the React tree unsubscribes the listener. It does not close the channel. React Strict Mode runs the cleanup and then the effect again, and closing the channel in that cleanup would end the bus for the rest of the visit.

## Alternatives rejected

- **A service worker.** It would outlive the tab and add a second cache with its own update rules. The value we want to share is the one already in memory.
- **Applying messages in arrival order.** A slow tab could overwrite a newer pulse with an older one.
- **Fetching again in the other tab.** That spends the request the channel just saved.

## Trade-offs

`BroadcastChannel` is same-origin. It does not survive a reload, and it does not reach a different site. Two requests already in flight in this tab both still hit the fetcher. The other tab learns the result. It does not join the request.

## Consequences

- The mirror on the data page is a second channel of the same name. A channel does not receive its own `postMessage`.
- [ADR 0014](0014-service-worker.md) caches a different request, `GET /api/pulse`. That body is not this in-memory entry.
- jsdom does not implement `BroadcastChannel`. The unit test uses an in-memory pair. The browser is where the channel is real.

## Further reading

- [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
