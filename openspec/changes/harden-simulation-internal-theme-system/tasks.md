## 1. Theme Contract

- [x] 1.1 Inventory simulation-internal panels, HUD labels, metric tiles, hints, local toolbars, and restore handles across all seven simulations.
- [x] 1.2 Define shared light/dark simulation primitives or token mappings for those surfaces.
- [x] 1.3 Replace resource-local hard-coded panel and text palettes with the shared contract.

## 2. Scene Parameters

- [x] 2.1 Define light and dark scene visual parameters for sky, water or ground, grid, fog, labels, HUD overlays, and emphasis markers where present.
- [x] 2.2 Wire theme parameters into each simulation scene without changing model state, controller state, or trace semantics.
- [x] 2.3 Verify object, label, and panel contrast in both themes.

## 3. Governance

- [x] 3.1 Add or update governance checks that detect new unapproved simulation resource palettes.
- [x] 3.2 Add visual evidence metadata proving theme parity covers internal panels and scene parameters, not only AppShell chrome.
- [x] 3.3 Run local React Doctor error-level checks for the affected simulation routes where feasible.

## 4. Visual Acceptance

- [x] 4.1 Capture desktop and mobile screenshots in light and dark theme for all seven simulation detail routes.
- [x] 4.2 Compare evidence against `artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md`, concept 2, and the 2026-06-15 audit contact sheets.
- [x] 4.3 Fail the change if any migrated route still shows dark AppShell with unchanged light simulation panels or scene parameters.
- [x] 4.4 Run `rtk openspec validate harden-simulation-internal-theme-system --strict`.
