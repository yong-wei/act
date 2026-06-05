## Why

The current platform uses shared dark surfaces but still lacks an ownable brand kit and equal light/dark design templates. Without governed tokens, typography, iconography, and asset rules, downstream pages will keep recreating dark cards, local accent colors, and generic developer-tool visuals.

## What Changes

- Create the brand application contract for mark usage, logo lockups, favicon, route badges, report watermark, instrument chrome, and evidence snapshots.
- Define two visual templates: light as engineering chart paper and dark as cinematic instrument workspace.
- Define token roles for canvas, surface levels, elevated panels, hairlines, trace accent, muted accent, danger, success, focus, evidence, and report output.
- Define icon, typography, numeric, texture, and visual-asset rules that can be enforced in later UI migrations.
- Treat light and dark as structurally distinct commercial templates rather than a simple color inversion of the same card system.
- Reject representative-route reintroduction of unmanaged page-local accent palettes such as raw slate/cyan/amber/violet/fuchsia classes unless mapped to brand token roles.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-commercial-brand-language`: adds brand kit and visual asset requirements.
- `platform-design-system-and-shell`: adds token and primitive requirements for dual-template implementation.

## Impact

- Affects `src/app/globals.css`, `tailwind.config.ts`, brand assets, favicon/app icons, route badge assets, report watermark assets, `src/components/platform/**`, and visual QA references.
