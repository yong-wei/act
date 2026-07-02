---
change_id: wire-sar-to-konling-grounding
claim_branch: wire-sar-to-konling-grounding
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - implement-sar-association-expansion-provider
  - integrate-source-pack-consumers
  - render-verified-konling-citations
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/wire-sar-to-konling-grounding
risk: high
area: ai
---

## Goal

Connect SAR association expansion to Konling grounding so answers can use multi-hop graph/resource/path/evidence context while verified citations still come from Source Pack/CitationChip metadata.

## Scope

- Add Konling SAR context metadata.
- Invoke SAR expansion for eligible modes and scopes.
- Feed SAR candidate refs into Source Pack retrieval.
- Redact student-visible trace and limitations.

## Out of Scope

- Implementing SAR core projection or expansion.
- Rendering CitationChips.
- Path planner selection.
- Graph Center associated evidence UI.

## Acceptance Checklist

- [ ] AC-1: Konling can call SAR expansion from scoped graph/path/resource/diagnosis contexts. Owner: independent reviewer.
  Evidence: runtime or route tests.
- [ ] AC-2: SAR candidate refs feed verified Source Pack/citation paths rather than becoming verified citations directly. Owner: independent reviewer.
  Evidence: tests or code review of citation flow.
- [ ] AC-3: Student-visible SAR trace is privacy-redacted and exposes limitations safely. Owner: independent reviewer.
  Evidence: privacy tests.
- [ ] AC-4: Path-advisor and diagnosis-explainer cases demonstrate SAR-assisted grounding. Owner: independent reviewer.
  Evidence: focused Konling tests.

## Tasks

- [ ] Task 1: Add Konling SAR context and mode wiring.
  Covers: AC-1
  Acceptance: eligible modes request SAR with server-owned seed refs.
  Evidence: runtime tests.
  Reviewer Check: confirm generic/unscoped modes do not overreach.
- [ ] Task 2: Bridge SAR candidate refs to Source Pack/citation retrieval.
  Covers: AC-2
  Acceptance: verified citations still come from Source Pack/CitationChip metadata.
  Evidence: citation flow tests.
  Reviewer Check: confirm SAR trace cannot create a verified citation.
- [ ] Task 3: Add redacted trace metadata.
  Covers: AC-3
  Acceptance: student payloads omit teacher/audit/private details.
  Evidence: privacy tests.
  Reviewer Check: confirm limitations are useful without leaking scoped evidence.
- [ ] Task 4: Add path-advisor and diagnosis-explainer fixtures.
  Covers: AC-4
  Acceptance: SAR-assisted grounding appears in representative modes.
  Evidence: tests.
  Reviewer Check: confirm results degrade gracefully when SAR or citations are unavailable.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
