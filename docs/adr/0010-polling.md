# ADR 0010: Poll on a timer, through the cache

Date: 2026-10-31
Status: Accepted

## Context

A screen that should stay fresh often starts `setInterval(fetch, 1000)` and then applies every response. Two requests overlap. A hidden tab keeps the radio on. An error retries at the same rate that caused it.

The request cache already drops a late body. The timer still needs a policy for when to send.

## Decision

`createPoller` has one in-flight call. A tick that arrives early increments a skip count and does not start a second request. A successful tick returns the interval to the base. An error doubles the wait, up to four seconds. Hiding the document clears the timer and aborts the request. Showing it starts a new tick.

The poll reads through `createQueryCache`. Abort still restores the previous record. The generation rule still applies if a caller fetches the same key by hand.

The catalog pulse is a live sequence and a timestamp. The race buttons above it stay on a scripted delay so that race is reproducible.

## Alternatives rejected

- **A queue of overlapping polls.** The later response is the one most likely to be stale, and the cache would spend its time discarding it.
- **Retrying an error on the same interval.** A failing endpoint gets the same traffic that produced the failure.
- **Polling from each screen with its own `loading` flag.** The status, the skip count, and the backoff would be copied until they diverged.

## Trade-offs

Skipping an in-flight tick drops a sample. That is the point: freshness is bounded by the slower of the interval and the request, not by how many requests we can launch.

The poller does not persist. A reload starts at the base interval. Backoff is per tab, like the cache.

The "hidden tab" control on the screen forces the same path as `document.hidden`, because a demo cannot always switch windows. The listener is still on `visibilitychange`.

## Consequences

- Stop and unmount abort the current request and clear the timer.
- The interval input is read on the next arm. A backoff in progress is not shortened by typing a smaller number until the next success or an idle refresh.
- Field polling still needs the beacon sampling rules. This timer is for a record on screen, not for telemetry.

## Scale and operations

Pause when the document is hidden. Back off when the request fails. Do not start a second request for a key that already has one open. Those three rules are the ones worth copying. The interval itself belongs to the screen.
