---
change_id: normalize-konling-citation-presentation
claim_branch: normalize-konling-citation-presentation
series: konling-chat-experience
coupling_group: konling-chat-experience
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/normalize-konling-citation-presentation
risk: medium
area: ai
---

## Goal

Normalize Konling final citation presentation so verified content citations remain clickable, fake model footnotes are suppressed, and citation limitations are applied per citation instead of globally.

## Scope

- Define and implement a normalized citation presentation model for Konling assistant messages.
- Separate development streaming diagnostics from final citation display state.
- Deduplicate citations by governed source identity.
- Restore safe click behavior for high-confidence or medium-confidence server-owned citation targets.
- Add focused tests for footnote suppression, limited personalization, deduplication, and linkability.

## Out of Scope

- Unified Konling chat UI layout and tool-call accordion work; that is covered by the dependent `unify-konling-chat-experience` change.
- Manual semantic field completion for knowledge graph nodes, textbooks, references, exercises, or learner evidence resources.
- Seeding Yang Fan or other test-student path history.

## Acceptance Checklist

- [ ] AC-1: Konling final messages use a normalized citation presentation model before rendering. Owner: independent reviewer.
  Evidence: Contract/helper diff plus targeted unit tests.
- [ ] AC-2: High-confidence or medium-confidence content citations with safe server-owned targets remain clickable even when personalization evidence is limited. Owner: independent reviewer.
  Evidence: Citation presentation tests covering missing learner-state or path-execution with clickable content citations.
- [ ] AC-3: Fake model-authored footnotes and current-page `#user-content-fn*` anchors are stripped, disabled, or excluded from verified citation rendering. Owner: independent reviewer.
  Evidence: Renderer tests for duplicate Markdown footnotes and generated footnote anchors.
- [ ] AC-4: Citation entries are deduplicated by type-aware governed identity without merging unrelated source types. Owner: independent reviewer.
  Evidence: Tests for repeated path-execution evidence, repeated content citations, and same-title different-type citations.
- [ ] AC-5: OpenSpec and targeted citation tests pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate normalize-konling-citation-presentation --strict` and targeted citation presentation test output.

## Tasks

- [ ] Task 1: Define the normalized citation presentation contract and helper boundary.
  Covers: AC-1
  Acceptance: Final Konling citation metadata is normalized into deterministic display items, summary state, diagnostics, and citation-level limitations before UI rendering.
  Evidence: Type/helper diff and unit test output.
  Reviewer Check: Confirm the normalizer is server-metadata first and does not treat model Markdown links as verified citations.
- [ ] Task 2: Implement per-citation clickability.
  Covers: AC-2
  Acceptance: Verified content citations with safe targets remain clickable when personalization data is limited, while citations with missing or restricted targets remain disabled.
  Evidence: Tests covering missing learner-state, missing path-execution, safe href, and missing href cases.
  Reviewer Check: Confirm the implementation does not use one global limitation flag to disable all citation links.
- [ ] Task 3: Suppress fake citation footnotes in assistant prose.
  Covers: AC-3
  Acceptance: Duplicate `[1]` links, GFM footnote definitions, and `#user-content-fn*` anchors do not appear as verified platform citations.
  Evidence: Renderer sanitizer tests.
  Reviewer Check: Confirm sanitized prose still preserves normal non-citation content.
- [ ] Task 4: Add type-aware citation deduplication.
  Covers: AC-4
  Acceptance: Repeated citations collapse by governed identity, and same-title citations from different source types remain distinct.
  Evidence: Deduplication test fixtures.
  Reviewer Check: Confirm path-execution duplicates no longer produce repeated generic entries.
- [ ] Task 5: Run validation and record evidence.
  Covers: AC-5
  Acceptance: OpenSpec strict validation and targeted citation tests pass.
  Evidence: Validation command output and test output.
  Reviewer Check: Confirm any remaining failures are unrelated and documented before AC approval.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
