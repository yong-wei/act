## Context

Archived knowledge graph specs already cover relation visual language, graph clarity, compact tools, and visual-semantic coverage. The new product design work adds stronger expectations for a unified AppShell, persistent right-bottom Konling assistant, stable graph interactions, and a product-level visual outcome.

This change is the final acceptance gate for the knowledge graph redesign series.

## Goals / Non-Goals

**Goals:**

- Verify that `/knowledge` behaves as a unified commercial workspace, not a collection of separate widgets.
- Ensure browser evidence covers real interaction states and current source/runtime contracts.
- Ensure concept references are used as direction and not copied into a conflicting shell.
- Block regressions in AppShell navigation, local tool placement, selected-node inspector, graph jitter, Konling dock, theme parity, and mobile behavior.

**Non-Goals:**

- Implement the UI changes owned by preceding proposals.
- Create GitHub Actions integration for heavy visual checks.
- Require pixel-perfect matching to generated concept images.

## Required Evidence Matrix

- Handoff-to-implementation matrix for `design-handoff.md`, `concepts/README.md`, and the three concept images.
- Desktop default route with AppShell navigation collapsed.
- Desktop with user-expanded navigation and persistence across a second AppShell route.
- Default graph state with compact local tools.
- Open directory, open relation filters, open graphical legend, and active summaries.
- Selected-node inspector with infograph preview and learning actions.
- Combined stress state with expanded AppShell, an opened local tool, selected-node inspector, and expanded Konling assistant.
- Keyboard focus handling for opened local tools, mobile sheets, inspector, and expanded Konling assistant.
- Hover preview without graph jitter.
- Node click without relayout.
- Dragged node position preserved after selection and inspector update.
- Explicit relayout/reset behavior.
- Konling dock collapsed and expanded with selected-node context.
- Konling no-selection and degraded context states.
- Light and dark themes.
- 320px mobile with local tools and inspector as sheets/drawers.

The combined stress state is required because isolated screenshots can pass while the real student workspace remains crowded or obstructed.

## Concept Reference Policy

Evidence must treat the handoff as authoritative:

- `artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md`
- `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/README.md`

Evidence should cite the concept images through the handoff's adopted, rejected, and merged guidance:

- `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/layered-research-atlas.png`
- `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/night-bridge-semantic-map.png`
- `artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/daylight-engineering-atlas.png`

Acceptance should confirm adoption of layered graph organization, premium dark visual tone, and light-mode clarity. It should reject standalone shell duplication, generated role switchers, exact mock labels, exact node positions, and duplicate assistant regions.

## Independent Visual Review Gate

This QA change cannot be accepted only by local screenshots or self-review. The implementation must run an independent visual review subagent after screenshots and current-source evidence are ready.

The subagent must receive:

- `design-handoff.md`
- `concepts/README.md`
- the three concept image paths
- implementation screenshots for the required evidence matrix
- changed files and evidence artifacts

The subagent must report PASS or BLOCK against handoff alignment, concept adoption/rejection, AppShell continuity, local graph tool integration, semantic-map readability, inspector hierarchy, Konling dock behavior, interaction stability, keyboard/focus behavior, theme parity, mobile behavior, and combined stress-state non-overlap. Any unresolved BLOCK finding prevents this QA change from being marked complete.

## Decisions

### 1. Final QA checks integration, not isolated widgets

The page fails if each part works separately but the combined workspace is still crowded, jittery, or inconsistent with the platform shell.

### 2. Runtime behavior matters more than screenshots

Screenshots remain necessary, but governance should also check current source or DOM contracts for interaction stability, local tool state, dock registration, and runtime relation coverage.

### 3. QA remains local unless quota policy changes

The project currently keeps expensive visual checks local due to GitHub Actions quota constraints. This change should define local scripts and evidence requirements, not CI expansion.

### 4. Handoff alignment is a hard gate, not a supporting note

The visual outcome can fail even when route inventory, tokens, screenshots, and DOM markers are present. QA must reject implementations that do not visibly follow the handoff's accepted knowledge-graph direction or that reintroduce rejected generated details.

## Dependencies

- Depends on `persist-app-shell-navigation-preference`.
- Depends on `stabilize-knowledge-graph-interaction-state`.
- Depends on `refine-knowledge-graph-semantic-map-presentation`.
- Depends on `redesign-knowledge-workspace-tools-and-inspector`.
- Depends on `connect-knowledge-workspace-konling-context`.
- Reuses archived knowledge graph visual language and layout clarity specs.
