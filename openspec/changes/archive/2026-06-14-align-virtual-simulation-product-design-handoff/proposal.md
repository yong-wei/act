## Why

The previous virtual simulation series landed route, shell, dock, theme, and governance infrastructure, but it did not convert the Product Design handoff and concept images into hard implementation acceptance criteria. The result is a governed baseline that still looks materially different from the confirmed design direction for the catalog and immersive simulation workspace.

## What Changes

- Treat `artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md` as the design source of truth for the follow-up implementation.
- Require the three concept images under `artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/` to be used as visual/layout references according to the adoption and rejection notes already written in the handoff.
- Align `/simulations` with concept 1's platform-continuity catalog: AppShell continuity, breadcrumb, search/filter, tabs or mode controls, efficient list/card browsing, recent/course/free-explore semantics, and no internal deployment-state leakage.
- Align `/simulations/*` with concept 2's immersive command-deck shell: full-scene visual primacy, glass-like top/side/control/bottom surfaces, edge-collapsible telemetry and control panels, bottom-adjacent local toolbar, contextual hint placement, and shared Konling dock behavior.
- Align simulation learning mission surfaces and Control Workbench regression coverage with concept 3 where the handoff accepts it: task chain, evidence/submission state, next action, and course-resource continuity, without adding page-local role switches or duplicate assistant panels.
- Require a subagent-based visual verification pass that reviews implementation screenshots against the handoff and concept images before the change can be accepted.
- Position this change before `govern-simulation-experience-visual-qa`; the final QA gate should validate the handoff-aligned implementation rather than freeze the current partial visual baseline.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `simulation-course-resource-integration`: require the simulation catalog to follow the Product Design handoff's accepted catalog information architecture and interaction model.
- `simulation-scene-shell-architecture`: require simulation detail pages to follow the handoff's immersive command-deck layout and panel behavior.
- `commercial-workspace-surface-system`: require simulation local panels, hints, bottom toolbar, task surfaces, and evidence areas to match the handoff's accepted workspace composition.
- `platform-commercial-brand-language`: require virtual simulation visual expression to use the handoff and concept images as visual references, not only token presence.
- `commercial-ui-governance-gates`: require visual evidence and subagent review to compare implementation against the handoff and concept images before final simulation visual QA.

## Impact

- Affects `/simulations`, `/virtual-lab` final behavior evidence, all current `/simulations/*` detail routes, simulation-local shell components, shared dock placement, route inventory metadata, and visual evidence artifacts.
- Does not change simulation physics, controller algorithms, Rust/WASM runtime calls, Arena scoring, or course evidence semantics.
- Blocks the final simulation visual QA issue until the handoff-aligned implementation has been proposed and implemented.
