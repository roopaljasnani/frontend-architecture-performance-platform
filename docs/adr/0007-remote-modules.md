# ADR 0007: Remote modules are an escape hatch

Date: 2026-10-30
Status: Accepted

## Context

Some surfaces really are deployed by another pipeline: a payments client, an embedded admin, a module another company owns. Pretending those do not exist pushes teams back toward Module Federation everywhere. Pretending every module is remote gives up the bundle gate.

## Decision

`loadRemoteModule` is the only supported remote path.

- The caller passes a URL, a timeout, a loader, and a contract predicate.
- Timeout, network failure, and an invalid shape are typed results: `timeout`, `load-error`, `invalid-contract`.
- The shell does not hang, and it does not throw those failures into the module error boundary. The boundary is for render failures. Load failures have their own retry.
- A valid contract carries `id`, `version`, and `owner`. Anything else is refused.
- Shared state is not smuggled through `window`. If a remote needs data, it receives props the shell understands.

The reference shell demonstrates the three outcomes with a fake loader so the behavior is visible without a network.

## Alternatives rejected

- **Importing whatever URL a team publishes.** No timeout, no contract, no owner. The shell becomes a script tag with a React tree.
- **Sharing runtime singletons by reaching into `window`.** Version skew then corrupts both apps, and the failure shows up far from the import.
- **Blocking first paint on the remote.** A slow remote becomes an LCP bug in the shell. The timeout exists so the shell can render a failure instead.

## Trade-offs

The default loader is a dynamic `import(url)`. Browsers will still refuse URLs that violate CSP or CORS. The platform does not weaken CSP to make remotes convenient.

A remote is invisible to the in-repo bundle gate unless its stats are published into the stats file. If you cannot get those stats, you do not get a budget, and [ADR 0004](0004-bundle-budgets.md) will fail the route. That is a feature. An unmeasured remote is not an architecture.

## Consequences

- Most modules never call `loadRemoteModule`.
- A remote needs an owner, a timeout, a contract test, and a way to disable it without a shell deploy (a flag the shell already owns).
- The overview screen is the executable version of this ADR.

## Scale and operations

Kill switch first, contract second, independent deploy third. If the remote team cannot meet the shell's React major, they do not get an exception in `resolveShared`. They get a conversation about moving the integration to a boundary that does not share the React runtime, such as a clearly isolated embed, with the accessibility and performance costs written down.
