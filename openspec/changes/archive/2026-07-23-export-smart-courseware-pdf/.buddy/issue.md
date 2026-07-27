---
change_id: export-smart-courseware-pdf
claim_branch: export-smart-courseware-pdf
series: smart-lesson-preparation
coupling_group: smart-courseware-runtime
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - publish-smart-courseware-to-classroom
parent_issue:
blocked_by:
  - publish-smart-courseware-to-classroom
blocking: []
openspec_path: openspec/changes/export-smart-courseware-pdf
risk: medium
area: courseware-export
---

## Goal

Export an authorized immutable courseware revision as a student-safe PDF with exactly one fixed 16:9 page per step, deterministic activity/reveal projection, and auditable revision-bound artifact evidence.

## Scope

- Dedicated student slide projection, fixed page geometry, final reveal state, and static online-activity treatment.
- Version and AI labels, answer/review-point exclusion, export storage, hashes, page evidence, and deterministic failures.

## Out of Scope

- Browser printing of the workspace DOM, PPTX export, editable slide files, multimodal generation, or authoritative runtime replacement.
- Draft export or export from a mutable/unpublished courseware state.

## Acceptance Checklist

- [ ] AC-1: The exported artifact contains exactly one 16:9 page per courseware step in order, uses final reveal/static activity projections, displays required labels, and excludes all teacher answers and review points. Owner: independent reviewer.
  Evidence: PDF parser/render tests for geometry, count, order, labels, reveal/activity content, and forbidden strings.
- [ ] AC-2: Export is authorized and bound to one immutable published revision, rejects draft/preview/unpublished input, records render/content/artifact identity, rejects overflow or inconsistent output, and remains a non-authoritative derivative. Owner: independent reviewer.
  Evidence: export API authorization, unpublished-input rejection, metadata/hash, page mismatch, overflow, revision mismatch, and failure-atomicity tests.

## Tasks

- [ ] Task 1: Implement the dedicated student slide projection.
  Covers: AC-1
  Acceptance: Every step maps to one fixed 16:9 page with final reveal, static online activity, required labels, and no teacher-only data.
  Evidence: Projection fixtures and PDF content/geometry parser tests.
  Reviewer Check: Inspect serialized projection and artifact text, not only screenshots.
- [ ] Task 2: Implement revision-bound PDF assembly, storage, and export evidence.
  Covers: AC-2
  Acceptance: Authorized export records revision, render version, content hash, page count, and artifact hash and rejects invalid geometry or overflow atomically.
  Evidence: Route, authorization, storage, hash, mismatch, overflow, and rollback tests.
  Reviewer Check: Confirm the PDF is generated from the slide projection rather than printing the workspace DOM.
- [ ] Task 3: Complete export regression and strict gates.
  Covers: AC-1, AC-2
  Acceptance: Focused PDF, type, authorization, and strict OpenSpec checks pass after the publication dependency is archived.
  Evidence: Final test output, sample artifact, typecheck, and strict change validation.
  Reviewer Check: Confirm PPTX and runtime authority remain outside scope.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
