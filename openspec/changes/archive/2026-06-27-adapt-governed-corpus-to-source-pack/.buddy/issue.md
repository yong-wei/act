---
change_id: adapt-governed-corpus-to-source-pack
claim_branch: adapt-governed-corpus-to-source-pack
series: unified-source-pack-retrieval
coupling_group: unified-source-pack-retrieval
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - define-source-pack-contract-and-cli-shell
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/adapt-governed-corpus-to-source-pack
risk: high
area: ai
---

## Goal

Adapt existing governed corpus records and runtime resource projections into Source Pack candidates without introducing an unmanaged retrieval corpus.

## Scope

- Map `LearningEvidenceCorpusChunk`, textbook/reference runtime search documents, and resource projection sidecars into Source Pack candidates.
- Hydrate citations from server-owned CitationAddress/CitationTarget metadata.
- Preserve privacy, source version, review state, AI-use permission, content hash, and limitation state.
- Keep retrieval/citation readiness separate from path eligibility.

## Out of Scope

- Final hybrid ranking and profile scoring.
- Consumer integration for Konling, lesson, homework, or path planning.
- New vector index service or embedding model rollout.

## Acceptance Checklist

- [ ] AC-1: Governed corpus adapters preserve provenance, privacy, review, and version metadata. Owner: independent reviewer.
  Evidence: adapter unit tests covering learning evidence chunks, textbook/reference runtime documents, and resource projections.
- [ ] AC-2: Citation hydration resolves from server-owned metadata and exposes limitations for unsafe or incomplete targets. Owner: independent reviewer.
  Evidence: citation hydration tests for valid, stale, unsafe, restricted, and missing citation targets.
- [ ] AC-3: Retrieval/citation readiness does not promote chunks into path-plannable nodes. Owner: independent reviewer.
  Evidence: tests proving `RetrievalChunk`/`CitationTarget` candidates require audited PlanningUnit/ResourceNode eligibility before path use.

## Tasks

- [ ] Task 1: Implement governed corpus adapters.
  Covers: AC-1
  Acceptance: Source Pack candidates retain source refs, span refs, citation refs, authority, privacy, freshness, review, source version, graph refs, and content hashes.
  Evidence: targeted adapter tests.
  Reviewer Check: confirm adapters do not scan raw authoring Markdown as the source of record.
- [ ] Task 2: Implement citation hydration and limitation handling.
  Covers: AC-2
  Acceptance: display citation payloads come from server-owned metadata and unsafe/incomplete targets are limited or excluded.
  Evidence: citation hydration test matrix.
  Reviewer Check: confirm model-authored links are never treated as verified citations.
- [ ] Task 3: Add eligibility-separation tests.
  Covers: AC-3
  Acceptance: retrievable/citable chunks remain separate from path eligibility unless a valid PlanningUnit/ResourceNode audit exists.
  Evidence: resource projection and path eligibility regression tests.
  Reviewer Check: confirm no code path promotes Source Pack evidence directly into PathNode candidates.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
