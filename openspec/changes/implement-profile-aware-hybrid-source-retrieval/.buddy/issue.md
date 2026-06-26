---
change_id: implement-profile-aware-hybrid-source-retrieval
claim_branch: implement-profile-aware-hybrid-source-retrieval
series: unified-source-pack-retrieval
coupling_group: unified-source-pack-retrieval
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - adapt-governed-corpus-to-source-pack
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/implement-profile-aware-hybrid-source-retrieval
risk: high
area: ai
---

## Goal

Implement profile-aware hybrid retrieval, ranking, diversification, and evaluation for Source Pack generation.

## Scope

- Define retrieval profiles for authoring, assessment, Konling, path planning, and lesson design.
- Apply permission, review-state, source-type, and AI-use filters before ranking.
- Combine exact/lexical, graph/objective, authority, freshness, learner-context, eligibility, and optional semantic signals.
- Assemble bounded and diverse packs with coverage and limitation metadata.

## Out of Scope

- Production vector index service or embedding model deployment.
- Consumer integration beyond reusable Source Pack builder APIs.
- Replacing ResourceNode or LearningEvidenceCorpus governance.

## Acceptance Checklist

- [ ] AC-1: Retrieval profiles enforce role, visibility, AI-use, review-state, source-type, and budget policies before ranking. Owner: independent reviewer.
  Evidence: profile policy tests for `handout-authoring`, `assessment-item`, `konling-answer`, `path-planning`, and `lesson-design`.
- [ ] AC-2: Hybrid ranking preserves exact technical matches and uses graph/objective context when supplied. Owner: independent reviewer.
  Evidence: ranking tests for formula, section title, graph node, capability target, and weak semantic-score cases.
- [ ] AC-3: Pack assembly enforces bounded excerpts, source/modality diversity, citation readiness, and limitation reporting. Owner: independent reviewer.
  Evidence: pack assembly and evaluation fixture tests covering duplicate sources and missing coverage.

## Tasks

- [ ] Task 1: Implement retrieval profiles and pre-ranking filters.
  Covers: AC-1
  Acceptance: profile policies control visibility, source type, review state, AI-use permission, and budgets.
  Evidence: profile policy tests.
  Reviewer Check: confirm filtering occurs before ranking/serialization and cannot leak disallowed evidence.
- [ ] Task 2: Implement hybrid ranking score fusion.
  Covers: AC-2
  Acceptance: exact/lexical and graph/objective matches survive weak or missing semantic signals.
  Evidence: deterministic ranking tests.
  Reviewer Check: confirm ranking uses governed refs and does not require a production vector service.
- [ ] Task 3: Implement pack assembly and evaluation fixtures.
  Covers: AC-3
  Acceptance: selected packs are bounded, diverse, citation-ready where required, and limitation-aware.
  Evidence: assembly tests and representative query fixtures.
  Reviewer Check: confirm omitted coverage and source concentration are auditable.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
