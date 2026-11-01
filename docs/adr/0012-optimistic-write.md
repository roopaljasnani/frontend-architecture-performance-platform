# ADR 0012: Show the save, then undo it if the write fails

Date: 2026-10-31
Status: Accepted

## Context

The route dialog had Save and Close, and both only closed the dialog. The note never appeared on the page, and a failed write had nothing to roll back.

## Decision

Save applies the draft to the page immediately, closes the dialog, and then runs the write. If the write rejects, the previous note is put back and the status says so. Close discards the draft and does not change the saved note.

`commitOptimistic` is the helper. It applies `next`, awaits `write`, and applies `previous` on rejection. The accessibility screen waits 40ms and can be told to reject, so the rollback is visible.

This app is React 18. React 19’s `useOptimistic` is the same idea. The steps are written out here so the rollback is visible in the package tests.

## Alternatives rejected

- **Save that only closes the dialog.** The control claims a write it does not do.
- **Waiting to paint the note until the response arrives.** The page feels slower, and a slow write looks like a missed click.
- **Keeping the rejected value on screen.** The page would show a note the server refused.

## Trade-offs

Between the click and the response, the page shows a note that might not stick. The status line is what tells you whether it stuck.

## Consequences

- The saved note is React state. A reload clears it. The point of the control is the rollback, not persistence.
- Abort is a failure. The previous value comes back.

## Further reading

- [useOptimistic](https://react.dev/reference/react/useOptimistic)
- [Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
