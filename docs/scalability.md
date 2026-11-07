# Scalability

This platform scales across teams by keeping the runtime shared and the ownership explicit. It does not scale by multiplying deployables.

## Team growth

| Teams | What changes | What stays |
| --- | --- | --- |
| 1–2 | Modules are folders. Budgets feel ceremonial. | Still register them. The ceremony is the point. |
| 3–8 | CODEOWNERS and review on budget changes matter. | One shell, one React major, one token set. |
| 8+ | Pressure appears to federate the busiest module. | Remote escape hatch only with stats, timeout, contract, and a kill switch. |

A new team does not get a new design system. They get a module id and a budget. If their surface cannot live inside the shell's React major, that is a product boundary, not a reason to fork React.

`packages/catalog-product` is that boundary inside this repo. It has its own registry (browse and search) and it uses the shell's React 18, tokens, contrast check, vitals gate, and gzip gate. The overview page runs that report. It is a second product in the repository, not a second deployment.

## Frontend scale

- **Route count.** The bundle analyzer is pure and is exercised at 300 routes in the harness. The gate stays in CI rather than moving to a nightly job that people ignore.
- **List length.** Windowing keeps DOM size tied to the viewport. The API should still page. Windowing is the client safety net, not permission to download the whole table.
- **SPA lifetime.** Vitals buffers are capped and reset on navigation. A dashboard left open for a day must not accumulate layout shifts into one CLS score.
- **Shared code.** One vendor chunk for React. Duplicate majors fail. Same-version copies warn until they are extracted.

## What will not scale

- Reviewing performance from screenshots.
- Letting each team pick a React major.
- An accessibility "program" that does not run in the shell test.
- Remote modules without published stats. They bypass the only bundle gate the platform has.

## Platform versus product

Platform owns metric definitions, tokens, the shell, and the gates. Product owns route behavior, the screen-reader pass for widgets they invent, and the decision to spend budget. Raising a budget is a product decision recorded in the stats file, reviewed by platform so the SLO and the bundle cap do not silently diverge.
