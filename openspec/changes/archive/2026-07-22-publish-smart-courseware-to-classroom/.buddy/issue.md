---
change_id: publish-smart-courseware-to-classroom
claim_branch: publish-smart-courseware-to-classroom
series: smart-lesson-preparation
coupling_group: smart-courseware-runtime
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - add-smart-courseware-generation-editor
parent_issue:
blocked_by:
  - add-smart-courseware-generation-editor
blocking:
  - export-smart-courseware-pdf
openspec_path: openspec/changes/publish-smart-courseware-to-classroom
risk: high
area: classroom-runtime
---

## Goal

Publish only the exact deterministically validated courseware draft as an immutable sequential version, project it into the existing catalog, and bind classroom execution and finalization to that exact revision and manifest.

## Scope

- Content-hash-bound static/browser receipts, individual teaching-goal/module source-gap and stale-plan acknowledgements, and immutable courseware versions.
- Transactional catalog projection and exact generated-courseware classroom binding with legacy compatibility.
- Deterministic P0 path and manual real-provider 45-minute root-locus classroom demonstration with natural-language multi-turn intake and authoritative content-quality evidence.

## Out of Scope

- Courseware generation/editor implementation, PDF/PPTX export, LLM publication gates, or automatic stale-plan regeneration.
- Replacing existing classroom lifecycle or rebinding active sessions to newer content.

## Acceptance Checklist

- [ ] AC-1: Publication eligibility requires current deterministic static and pinned-browser receipts for the exact content hash, requires every teaching-goal and module source gap to have a current individual acknowledgement, and never uses LLM review as a gate. Owner: independent reviewer.
  Evidence: receipt, invalidation, stable-code, browser-version/font-version, both canonical pending lineage states, goal/module gap identity, no-implicit-acknowledgement, unrelated-edit preservation, explicit individual acknowledgement, and AI-disagreement tests.
- [ ] AC-2: Publication freezes sequential `互动课件第N版（基于教案第M版）` revisions with individual goal/module source-gap and stale-plan acknowledgements and a transactional governed catalog projection. Owner: independent reviewer.
  Evidence: transaction, version, cross-child canonical source-state contracts, both pending lineages, goal/module acknowledgement identity preservation/invalidation, immutable history, projection, and rollback tests.
- [ ] AC-3: Generated classroom sessions bind and retain the exact published revision and manifest through student runtime and finalization, fail safely on integrity errors, and preserve legacy launches. Owner: independent reviewer.
  Evidence: classroom API/Playwright lifecycle, hash mismatch, finalization, authorization, and legacy/preset regression tests.
- [ ] AC-4: The standard 45-minute root-locus lesson starts through Konling natural language, resolves one ambiguity, accepts a later-turn constraint revision, proves at least three authoritative content-quality cases with zero unresolved goal/module source gaps, completes the ordinary import-to-classroom path with a real configured provider, and clearly labels any backup revision. Owner: independent reviewer.
  Evidence: timestamped manual conversation and run record, structured task diffs, authoritative source comparison, authorized provider audit, stage/gate/publication/classroom evidence, and backup labeling screenshots.

## Tasks

- [ ] Task 1: Implement deterministic publication receipts and acknowledgement identity.
  Covers: AC-1, AC-2
  Acceptance: Only current content-bound receipts plus exact teaching-goal/module source-gap and stale-plan acknowledgements authorize publication; unrelated edits preserve unchanged gap acknowledgements but invalidate whole-draft receipts; plan/editor/whole-course approval and projection never imply acknowledgement; and AI reports remain advisory.
  Evidence: Static/browser integration, both pending lineage values, upstream gap-id stability/change fixtures, no-implicit-acknowledgement cases, unrelated-edit receipt invalidation with acknowledgement preservation, explicit per-gap acknowledgement, and AI-disagreement tests.
  Reviewer Check: Confirm state matching never parses display text, upstream gap identity alone controls individual acknowledgement validity, whole-draft hashes control gate receipts, every pending gap requires explicit confirmation, and no approval or LLM verdict enters eligibility.
- [ ] Task 2: Implement immutable versions and transactional catalog projection.
  Covers: AC-2
  Acceptance: A successful transaction creates the next courseware version and complete governed projection; failure creates neither partial state nor mutable history.
  Evidence: Concurrency, transaction rollback, version numbering, projection, and immutability tests.
  Reviewer Check: Confirm published revisions and existing sessions cannot change when a new draft is edited.
- [ ] Task 3: Bind classroom lifecycle to exact generated content with legacy compatibility.
  Covers: AC-3
  Acceptance: Preparation, active class, student rendering, and finalization resolve the bound revision/hash and recover explicitly from corruption.
  Evidence: Generated and legacy classroom route/Playwright tests plus integrity failure fixtures.
  Reviewer Check: Confirm no fallback to latest generated content occurs.
- [ ] Task 4: Complete deterministic and real-provider P0 acceptance.
  Covers: AC-4
  Acceptance: Automated fixtures and one timestamped real-provider run cover natural-language task creation, ambiguity clarification, later-turn constraint revision, zero unresolved source gaps, three authoritative content-quality cases, and student classroom execution through ordinary UI/APIs.
  Evidence: Deterministic E2E artifacts, structured conversation/task evidence, source comparisons, and the manual provider-backed demonstration record.
  Reviewer Check: Confirm provider authenticity, conversation continuity, source completeness, current-run identity, and backup labeling rather than accepting a prerecorded backup as live output.
- [ ] Task 5: Complete regression, viewport/theme, documentation, and project gates.
  Covers: AC-1, AC-2, AC-3
  Acceptance: Targeted migration/API/Playwright, typecheck, relevant build, strict OpenSpec, and desktop/mobile light/dark evidence pass on the final diff.
  Evidence: Final command output, browser artifacts, and updated project/operator/privacy/demo documentation.
  Reviewer Check: Confirm all required P0 behavior is represented and PDF remains a separate P1 child.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
