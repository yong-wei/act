## Why

The current platform has usable shell and navigation foundations, but it does not yet have a commercial brand language. Pages still feel like separate internal tools because visual meaning, logo logic, color roles, typography, and motion rules are not specified as product identity.

## What Changes

- Define a commercial brand strategy for the platform as a maritime control learning system rather than a generic AI education site.
- Define logo, mark, color, typography, icon, motion, texture, and layout principles that can drive UI, reports, course entrances, Arena, and workbench surfaces.
- Define required brand-kit application artifacts and acceptance examples so the brand contract is not only prose.
- Establish explicit anti-patterns for page-local palettes, purple-blue AI gradients, decorative card matrices, and mixed shell systems.
- Define brand application rules for navigation, student entry surfaces, workbench instrumentation, data center snapshots, course runtime, and reports.

## Capabilities

### New Capabilities
- `platform-commercial-brand-language`: Defines the platform brand identity, visual tokens, motifs, typography, motion, and application rules.

### Modified Capabilities
- `platform-design-system-and-shell`: Future shell and token work will consume the commercial brand language, but this change does not alter the existing shell contract.

## Impact

- Affects future `src/app/globals.css`, `tailwind.config.ts`, shared shell primitives, homepage, login/auth surfaces, Arena, adaptive learning, Control Workbench, interactive course hubs, teacher/admin workspaces, reports, and generated brand assets.
- Does not implement page migrations; downstream changes consume this brand contract.
