---
change_id: add-teacher-course-basis-management
claim_branch: add-teacher-course-basis-management
series: smart-lesson-preparation
coupling_group: smart-prep-source-plan
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking:
  - add-smart-lesson-plan-authoring
openspec_path: openspec/changes/add-teacher-course-basis-management
risk: medium
area: teacher-authoring
---

## Goal

Let a teacher create a private reusable course basis from supported standards and textbook material, verify stable extraction anchors, and retrieve only confirmed immutable versions through governed lesson-design sources.

## Scope

- Teacher-owned course bases, immutable document versions, and rights/provenance records for packaged demonstration sources.
- Markdown, plain text, pasted text, and searchable PDF extraction review.
- Governed corpus projection, scoped Source Pack retrieval, and root-locus demo import.

## Out of Scope

- OCR, DOCX/PPTX ingestion, plan generation, courseware generation, publication, and export.
- Cross-teacher sharing, coauthoring, public templates, or raw-upload retrieval.

## Acceptance Checklist

- [ ] AC-1: Supported inputs produce reviewable stable anchors, confirmed versions, and explicit scan-only PDF rejection. Owner: independent reviewer.
  Evidence: browser/API format fixtures, extraction snapshots, anchor hashes, and rejection tests.
- [ ] AC-2: Course-basis versions remain owner-private, immutable after confirmation, retire safely, and cannot be deleted while referenced. Owner: independent reviewer.
  Evidence: authorization, version lifecycle, retirement, deletion-protection, and migration tests.
- [ ] AC-3: Only confirmed selected versions enter governed `lesson-design` Source Packs, and the ordinary root-locus demonstration records source rights without publicly redistributing restricted textbook text. Owner: independent reviewer.
  Evidence: corpus projection, scoped retrieval, citation-target, SAR candidate, rights/provenance manifest, restricted-source packaging, and demo-package integration tests.

## Tasks

- [ ] Task 1: Add course-basis persistence, migration, lifecycle, and authorization.
  Covers: AC-2
  Acceptance: Owner/admin rules, sequential immutable versions, retirement, references, indexes, and rollback are enforced.
  Evidence: Migration output plus API and authorization tests.
  Reviewer Check: Verify historical references cannot be mutated or destroyed and other teachers/students cannot retrieve records.
- [ ] Task 2: Implement supported ingestion, extraction preview, confirmation, and failure recovery.
  Covers: AC-1
  Acceptance: Every supported input has stable hash-backed anchors and scan-only or unsupported inputs fail explicitly.
  Evidence: Markdown/text/paste/PDF fixtures and browser extraction evidence.
  Reviewer Check: Confirm no OCR promise or silent empty extraction exists.
- [ ] Task 3: Project confirmed segments into governed retrieval.
  Covers: AC-3
  Acceptance: Source Pack results retain owner, version, target, anchor, hash, lifecycle, and SAR verification state without reading raw uploads.
  Evidence: Corpus adapter, retrieval authorization, citation, and lifecycle tests.
  Reviewer Check: Confirm unconfirmed, retired-ineligible, or foreign versions do not enter generation context.
- [ ] Task 4: Add the teacher workflow and demonstration package, then run the change gates.
  Covers: AC-1, AC-2, AC-3
  Acceptance: The complete browser workflow and Hu Shousong/course-standard demo import operate through ordinary APIs, record the rights basis, avoid unauthorized public redistribution, and pass all targeted gates.
  Evidence: Browser evidence, demo files, rights manifest, restricted-packaging fixture, focused tests, typecheck, migration check, and strict OpenSpec validation.
  Reviewer Check: Confirm the demo does not bypass ownership, extraction review, governed projection, or source-rights constraints.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
