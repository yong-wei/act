## Context

The Product Design audit for virtual simulation produced a confirmed handoff at `artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md` plus three concept images:

- `concepts/concept-1-platform-continuity.png`
- `concepts/concept-2-command-deck-shell.png`
- `concepts/concept-3-learning-mission-studio.png`

The prior virtual simulation series implemented the information architecture, `SimulationShell`, local tool panels, shared Konling dock, and theme tokens. That work improved governance but did not make the handoff and concept images the implementation contract. The follow-up should convert the handoff's explicit "可采纳 / 必须修订 / 不应包含" guidance into implementation and evidence requirements.

## Goals / Non-Goals

**Goals:**

- Make the handoff and concept images the design source of truth for the next virtual simulation UI implementation.
- Align `/simulations` with the accepted concept 1 catalog structure while preserving the `/virtual-lab` compatibility decision.
- Align `/simulations/*` with the accepted concept 2 command-deck composition: scene primacy, glass-like overlays, collapsible panels, bottom-adjacent tools, and shared dock behavior.
- Carry forward concept 3's accepted learning mission semantics without introducing rejected page-local role switches or duplicate assistant regions.
- Require visual verification by a subagent that compares screenshots against the handoff and concept images.

**Non-Goals:**

- Pixel-perfect copying of generated concept images.
- Reintroducing model deployment/version status as student-facing catalog truth.
- Adding student/teacher role switches to simulation pages.
- Adding a second page-local Konling panel beside the shared dock.
- Changing simulation physics, controller algorithms, Arena scoring, or Rust/WASM runtime behavior.

## Decisions

### 1. Handoff is the contract; concept images are bounded references

Implementation must treat `design-handoff.md` as authoritative. The concept images are required references only through the handoff's adopted/rejected guidance. This avoids copying rejected details such as model-status columns, role switching, or a separate assistant panel.

Alternative considered: treat concept images as pixel references. That conflicts with the handoff and would make generated details override confirmed product decisions.

### 2. Catalog alignment is a first-class UI change

The catalog must move beyond "cards with platform tokens" toward the accepted platform-continuity structure: AppShell continuity, breadcrumb, search/filter, task-family navigation, recent/course/free-explore grouping, and efficient list/card browsing. Internal model deployment status remains excluded.

Alternative considered: leave `/simulations` as the current card grid and only improve screenshots. That would preserve the main visible gap called out by the user.

### 3. SimulationShell alignment must change composition, not only markers

The detail-page shell must make the primary simulation scene the largest visual layer and organize telemetry/control surfaces as translucent overlays or edge panels with explicit collapse handles. The bottom toolbar must sit near the bottom workspace edge, and hints must sit above it without covering primary controls.

Alternative considered: keep the current grid panels and add more governance metadata. That would satisfy tests but not the Product Design direction.

### 4. Learning mission semantics are accepted only where they do not fork the shell

Concept 3 contributes task chain, evidence/submission state, current objective, next action, and resource continuity. It does not justify a page-local role switch or standalone assistant column because the handoff explicitly rejects those.

Alternative considered: build concept 3 as a separate mode with its own right panel. That would duplicate platform navigation and Konling behavior.

### 5. Visual verification must be independent

The implementation must produce screenshots and a short subagent visual verification report. The reviewing subagent should be given the handoff path, concept image paths, and implementation screenshots, then answer whether the accepted design elements are visibly present and rejected elements are absent.

Alternative considered: rely only on automated `data-*` gates. That already failed to catch the gap between the current implementation and the concept direction.

## Risks / Trade-offs

- Visual alignment can drift into pixel-copying. Mitigation: the handoff remains the source of truth and explicitly limits concept-image use.
- Full-screen simulation composition can hide controls on mobile. Mitigation: mobile evidence must prove command surfaces preserve the primary scene and core controls.
- Translucent overlays can hurt contrast. Mitigation: light/dark screenshots and accessibility checks must cover text, controls, focus, and panel boundaries.
- Subagent review can become subjective. Mitigation: provide a checklist derived directly from handoff sections and require pass/fail findings tied to screenshots.

## Migration Plan

1. Audit current `/simulations`, representative `/simulations/destroyer`, `/simulations/drilling`, `/simulations/cruise`, and `/interactive-learning/control-workbench` against the handoff.
2. Rework the catalog layout to match accepted concept 1 structure and remove remaining hero/card-only composition.
3. Rework `SimulationShell` and local tool layout to match accepted concept 2 composition while preserving runtime children.
4. Add accepted concept 3 mission semantics where course/task context exists.
5. Capture light/dark desktop and mobile evidence.
6. Run a subagent visual verification pass against the handoff and concept images.
7. Update or unblock final simulation visual QA so it validates the aligned implementation.

## Open Questions

- Whether `/simulations` should default to list view with optional card toggle, or keep card view as a secondary mode after the handoff-aligned list exists.

## Resolved Implementation Constraints

- `/virtual-lab` must choose one handoff-approved compatibility role during implementation: redirect, model-library subpage, or compatibility entry fully reusing `/simulations`.
- Concept 3 acceptance must use `/interactive-learning/control-workbench` or a course-embedded simulation resource as the sample and must define both available-data and missing-data behavior.
