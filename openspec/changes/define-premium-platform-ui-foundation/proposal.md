## Why

Two rounds of browser-based visual review showed that the platform already has strong isolated surfaces, but the overall product still reads as several unrelated applications. Homepage, login, Interactive Learning, simulations, Control Workbench, Arena, student profile, teacher, and admin pages use inconsistent shell patterns, navigation hierarchy, theme treatment, and bottom-right controls.

This change establishes the premium platform UI foundation before page-family migrations begin. It assumes the currently unfinished adaptive learning, control-correction, and intelligent teaching assistant changes will be completed and treats them as future baseline capabilities, not as blockers for defining the UI system.

## What Changes

- Define a premium maritime control-learning visual foundation with light/dark parity.
- Define the canonical navigation model: global product navigation, role cockpit navigation, contextual workspace navigation, and local tool navigation.
- Extend the shared shell contract so primary routes can converge on one role-aware frame rather than page-local headers.
- Standardize the bottom-right Konling and management controls as a shared floating action dock with consistent position, spacing, collapse behavior, and theme treatment.
- Require background Playwright/browser screenshot evidence for representative light and dark surfaces during UI migration review.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-commercial-brand-language`: add premium light/dark visual-world parity and reject disconnected page skins.
- `platform-design-system-and-shell`: add shared shell and floating action dock requirements.
- `platform-role-navigation`: add explicit multi-layer navigation semantics and route inventory requirements.
- `commercial-ui-governance-gates`: add visual QA evidence requirements for the new unified shell and floating action dock.

## Impact

- Affects shared platform shell, navigation registry, semantic tokens, theme handling, visual QA scripts, and review gates.
- Provides the baseline for subsequent public entry, immersive workspace, learner profile, teacher/admin, and knowledge graph UI migrations.
- Does not migrate individual page families yet.
