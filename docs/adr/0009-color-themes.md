# ADR 0009: One token set, two palettes

Date: 2026-10-31
Status: Accepted

## Context

A theme switch that introduces a second set of component colors will pass in the screenshot and fail the contrast contract, or it will pass contrast and drift from the components that still read the old variables.

## Decision

`platform-tokens` publishes `dark` and `light` with the same keys. Components keep reading `--platform-*`. The document chooses a palette with `data-theme` and `color-scheme`. The preference is `system`, `light`, or `dark`. `system` follows `prefers-color-scheme`. The stored key is `platform-theme`.

`index.html` applies the saved choice before the module runs. React applies it again and listens for OS changes while the preference is `system`.

## Alternatives rejected

- **A second stylesheet per component.** The contrast test would be checking a palette the button is no longer using.
- **Toggling class names that hard-code hex in the shell.** The rail, the dialog, and the budget meter would each invent a light color.
- **Following the OS with no stored choice.** A person who needs a specific palette cannot keep it across a machine that changes appearance on a schedule.

## Trade-offs

The light palette cannot reuse the dark accent as text. Accent ink and accent swap roles so the primary button and the label that uses accent as text both clear AA. The shapes of the UI do not change.

The inline script in `index.html` duplicates the storage key. It is there so the first paint does not flash the other palette.

## Consequences

- Both palettes are asserted from `platform-a11y`.
- Budget fills use the CSS variables, so a theme change recolors them without a React render of the meter.
- The accessibility screen can load either text pair into the contrast checker. The checker still computes the ratio. It does not trust the theme name.

## Scale and operations

Theme is a document setting, not a module setting. A product surface that needs a third palette has to add it as another entry in `themes` and extend the contrast pairs. A one-off hex on a screen is a bug.
