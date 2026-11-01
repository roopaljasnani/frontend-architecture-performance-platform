# ADR 0006: Accessibility as a tested contract

Date: 2026-10-30
Status: Accepted

## Context

Accessibility work dies in two ways. It becomes a checklist nobody runs, or it becomes a proprietary ruleset that a team claims is "WCAG certified." Neither is useful. The design system can prevent a known set of failures on every commit, and it should be honest about the failures it cannot see.

## Decision

`platform-a11y` checks the contracts this platform can break:

- Button and link names
- Image `alt` (empty alt is valid for a decorative image; a missing attribute is not)
- Form control names from `aria-label`, `aria-labelledby`, `label[for]`, or a wrapping label
- Heading order, with no skipped levels
- A single `main` landmark
- `tabindex` greater than 0
- Duplicate ids
- Contrast ratios for 6-digit hex colors, with WCAG 2.2 AA and AAA bars (4.5:1 body AA, 3:1 large text and UI components, 7:1 body AAA)

The shell test renders every module and expects `audit(document)` to be empty.

A broken fixture stays detached until someone asks to audit it. Known failures are not left mounted in the reference UI.

## Alternatives rejected

- **A manual checklist with no regression test.** It does not survive the next unlabeled icon button.
- **Calling this auditor a WCAG certification.** It does not execute scripts, it does not drive a screen reader, and it does not understand a custom listbox. IAAP WAS and an axe-core pass exist because this problem is larger than a unit test.
- **Positive tabindex and unlabeled controls as local exceptions.** They are cheap to write and expensive to operate. The contract refuses them.

## Trade-offs

The name calculation is a subset of the accessible name algorithm. It does not implement every aria-labelledby cycle or hidden-text rule. It is good enough to stop the design system from shipping unnamed buttons, and it will miss exotic composition.

Contrast is computed from authored hex, not from `getComputedStyle`. Gradients, opacity, and images of text are out of scope. Token tests cover the pairs the platform actually ships.

axe-core is not bundled. Product apps should run it against rendered routes in CI in addition to this contract. Screen reader passes remain manual for composite widgets.

## Consequences

- A pull request that removes a label fails the shell test.
- Token colors used as text are asserted against the background token.
- The accessibility screen can audit the live page or the detached fixture. The fixture is not in the accessibility tree by default.
- The shell moves focus to the new module heading and announces the module title. The first load leaves focus alone so the skip link still works.
- The route dialog moves focus inside, cycles Tab within the dialog, closes on Escape, and returns focus to the opener. That path is tested because `audit` cannot see a focus trap.

## Scale and operations

Platform owns the rules. Product teams own the screen reader pass for widgets they invent. A new composite widget does not get a platform exception; it gets a test that models its name, keyboard path, and focus return. If the in-house auditor cannot see that widget, add a targeted test rather than weakening `audit`.
