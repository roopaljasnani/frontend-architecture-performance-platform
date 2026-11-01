# ADR 0008: Cache records by route template

Date: 2026-10-30
Status: Accepted

## Context

Screens that load records invent a boolean called `loading` and then apply whichever response arrives last. A token in the URL becomes part of the cache key. The shell already has a route template for metrics. The data path should use it.

## Decision

`platform-data` stores one entry per normalized key. The first response with no record is pending. A refetch that already has a record is stale until the new payload arrives. Each fetch takes a generation. A response from an older generation is ignored. Aborting the current request restores the previous snapshot instead of recording an error.

The catalog screen keys that cache with `normalizeRoute`, the same function the vitals collector uses.

## Alternatives rejected

- **A loading boolean per screen.** It cannot tell pending from stale, and it loses the race.
- **The raw URL as the key.** `/orders/42?token=secret` and `/orders/42?token=other` would be two records, and the token would sit in memory as an identifier.
- **Arrival order.** The network does not know which click was last.

## Trade-offs

The cache is in memory. It does not survive a reload, and two calls already in flight both hit the fetcher. The rule is only about which response is allowed to land. [ADR 0013](0013-cross-tab-cache.md) copies a landed entry to other tabs.

## Consequences

The data screen can show pending, stale, fresh, and error. A scripted race keeps `current order` and reports the late response as ignored.
