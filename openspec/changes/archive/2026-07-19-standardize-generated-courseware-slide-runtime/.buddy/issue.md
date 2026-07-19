---
change_id: standardize-generated-courseware-slide-runtime
claim_branch: standardize-generated-courseware-slide-runtime
series: smart-lesson-preparation
coupling_group: smart-courseware-runtime
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking:
  - add-smart-courseware-generation-editor
openspec_path: openspec/changes/standardize-generated-courseware-slide-runtime
risk: high
area: interactive-runtime
---

## Goal

Standardize generated interactive-courseware steps as fixed 16:9 slide canvases composed from registered layouts, slots, sizes, modules, and deterministic static/browser validators without regressing preset lessons.

## Scope

- Shared BOPPPS stage-step-module manifest, timing, finite layouts, slots, size variants, and text budgets.
- Strict generated-module and canonical-response allowlist.
- Fixed-canvas renderer, responsive whole-canvas scaling, deterministic static and pinned-browser validation, and preset compatibility.

## Out of Scope

- LLM generation workflow, teacher editor, publication receipts, classroom binding, and PDF export.
- Arbitrary coordinates, runtime module registration, multimodal modules, simulations, scrolling slides, or preset lesson migration.

## Acceptance Checklist

- [ ] AC-1: Schema and occupancy validation enforce six ordered BOPPPS stages, 6–24 steps, 1–3 modules, exact timing, fixed 16:9 templates, slots, sizes, and text budgets. Owner: independent reviewer.
  Evidence: manifest parser, timing, occupancy, size, text-budget, and invalid-geometry fixtures.
- [ ] AC-2: The shared renderer accepts only registered generated modules, scales the fixed canvas as one unit, preserves role states, and keeps representative preset lessons compatible. Owner: independent reviewer.
  Evidence: registry, canonical response, renderer, role, route, and legacy preset regression tests.
- [ ] AC-3: Pure static and pinned-browser validators deterministically reject bounds, overlap, clipping, scrolling, formula-width, and unreadable-font failures with stable locations. Owner: independent reviewer.
  Evidence: stable issue-code fixtures and fixed-viewport Playwright failure/success evidence.

## Tasks

- [ ] Task 1: Define and register the generated slide manifest, layouts, sizes, text budgets, modules, and response kinds.
  Covers: AC-1, AC-2
  Acceptance: The finite schema expresses all required hierarchy and geometry without arbitrary coordinates or dynamic registration.
  Evidence: Type/schema, registry, timing, occupancy, and invalid allowlist tests.
  Reviewer Check: Confirm fixed dimensions make page occupancy decidable and unsupported modules fail closed.
- [ ] Task 2: Implement fixed-canvas rendering, bounded font fitting, responsive scaling, and preset compatibility.
  Covers: AC-1, AC-2
  Acceptance: Valid generated slides remain fixed internally on all screens and existing preset manifests render unchanged.
  Evidence: Renderer unit tests and representative generated/preset browser routes.
  Reviewer Check: Confirm no clipping, hidden overflow, internal scrolling, or forced preset migration.
- [ ] Task 3: Implement static and fixed-viewport browser validators with content-hash identity.
  Covers: AC-3
  Acceptance: Every declared geometry/readability failure returns a stable machine-readable location and changed content cannot reuse old results.
  Evidence: Static fixtures and pinned-font Playwright measurement tests.
  Reviewer Check: Confirm validator outcomes are deterministic and contain no LLM judgment.
- [ ] Task 4: Complete shared-runtime regression gates.
  Covers: AC-1, AC-2, AC-3
  Acceptance: Schema, renderer, response, preset, browser, type, and strict OpenSpec suites pass on the final diff.
  Evidence: Targeted test output, typecheck, browser artifacts, and strict change validation.
  Reviewer Check: Confirm both generated and legacy paths were exercised.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
