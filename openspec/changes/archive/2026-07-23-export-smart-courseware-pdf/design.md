## Context

This P1 child consumes immutable published courseware revisions and the fixed slide renderer. It creates a portable derivative and does not participate in P0 publication eligibility.

## Goals / Non-Goals

**Goals:** one 16:9 page per step, student-safe static semantics, revision/export evidence, and deterministic export validation.

**Non-Goals:** PPTX, editable slide source, browser printing of the workspace, teacher-answer PDF, or changing courseware content.

## Decisions

### 1. Use a dedicated student slide projection

Export renders the fixed slide canvas without editor/navigation chrome. Reveal content uses final expanded state. Activities retain prompts/options/tasks, omit answers/review points, and indicate online completion.

### 2. Keep the courseware revision authoritative

Each export records revision id, manifest hash, renderer version, page count, output hash, actor, and time. A newer revision requires a new export.

### 3. Assemble pages rather than print the workspace

The dedicated renderer produces fixed slide pages that `pdf-lib` assembles. Validation checks geometry, order, page count, overflow, missing modules, labels, and teacher-content leakage before delivery.

## Risks / Trade-offs

- [Raster pages reduce accessibility] -> Keep semantic courseware as truth and leave room for a later vector renderer.
- [Static activities imply offline submission] -> Display explicit online-completion language.
- [Export diverges from runtime] -> Reuse the same fixed layout registry and content hash.

## Migration Plan

Add export records and worker/API routes after publication is archived. No existing content is migrated. Rollback removes export entry points while preserving generated files and evidence according to retention policy.

## Open Questions

None.

## Testing Strategy
Change class: medium-risk
Seam status: required
Public behavior: An authorized teacher can export an immutable courseware revision as a student-safe PDF with exactly one fixed 16:9 page per step and no teacher-only content.
Public seam: Teacher PDF export route and resulting PDF artifact parsed for page geometry, order, labels, static activity treatment, revision identity, and forbidden teacher content.
Existing seam reused: Fixed slide renderer fixtures, `pdf-lib`, route authorization tests, and Playwright/PDF artifact test utilities.
AC coverage: AC-1: render and PDF parsing evidence verifies one 16:9 page per step, final reveal state, online activity prompts, AI/version labels, and no answers or review points; AC-2: export API and failure fixtures verify immutable revision binding, export metadata, page count/order, overflow rejection, and non-authoritative derivative semantics.
Manual-only acceptance: none
Rationale: The exported PDF artifact is the public result, so parsing and inspecting that artifact at the route boundary directly verifies geometry, role safety, revision identity, and deterministic failure behavior.
