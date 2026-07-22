## Context

The audit records a large node and relation corpus with exact-name conflicts; derived identity, relation-review, resource-endpoint, domain-seed, and block counts are not yet reproducible contract inputs. Prototype blocks are therefore not an execution plan, and endpoint signatures can move with component ownership. `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0045 files indexed by `docs/adr/README.md`, `docs/proposals/course-knowledge-base-governance-source-registry.yaml`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md` are the shared decision and evidence sources.

## Existing entry point

Existing entry point: not applicable. This tracking-only parent implements no CLI; each executable child owns its own read-only command or subcommand.

Each executable child's CLI contract follows docs/proposals/course-knowledge-base-governance-source-derivation-contract.md: versioned normalization, canonical ordering, path and newline normalization, deterministic missing-file records, separate governance/source/upstream digests, per-source and aggregate digests, expected/observed drift, synthetic fixtures, fixed real-snapshot integration tests, byte-identical repeated runs, and no-write assertions.

## Goals / Non-Goals

**Goals:**

- Coordinate eight preparation children that freeze exact future-child manifests.
- Preserve exclusive capability ownership and the declared acyclic dependency graph.
- Make the absence of the second-stage parent and content-block changes an explicit correctness condition.

**Non-Goals:**

- Implement governance scripts, runtime behavior, content decisions, or production release.
- Guess final block counts or create provisional second-stage Buddy changes.

## Decisions

### 1. Use a tracking-only preparation parent

The parent owns only series inventory, dependency semantics, and completion. Treating it as executable would duplicate child work and violate the one-change/one-delivery boundary.

### 2. Fix the eight-child dependency graph

Inventory feeds identity and domain-candidate derivation independently; partition waits for both; cross-identity waits for partition; cross-relation and atomic-resource each wait for partition plus cross-identity; validation waits for all three review manifests. Alternatives based on provisional counts are rejected because owner changes alter downstream queues.

### 3. Gate the second stage on one exact record schema

Every future-child record contains `change_id`, `work_kind`, `schema_version`, `algorithm_version`, `normalization_profile`, `exact_count`, structured `exact_items`, applicable `candidate_concept_count`, applicable `owner_block`, complete cross-block `endpoint_blocks`, change-ID `blockedBy`, structured `source_digests`, `governance_contract_digest`, `source_snapshot_digest`, structured `upstream_manifest_digests`, `required_outputs`, `acceptance_profile`, and `scope_anchor_ids`. Each exact item contains `item_kind`, `identity_namespace`, `source_id`, and `source_digest`; `exact_count` equals `exact_items.length`. Equal strings in different namespaces remain distinct. In-block relations, cards, and migration inputs are exact items. The six work kinds enforce field applicability defined in `docs/proposals/course-knowledge-base-rebuild-series.md`; no wildcard, placeholder, mutable endpoint, singular top-level `source_digest`, or legacy `exact_item_ids` is sufficient.

## Risks / Trade-offs

- [Source data changes after inventory] → Downstream manifests bind source digests and final validation rejects stale bindings.
- [The parent is mistaken for product work] → Triage uses `series-parent`, issue text is tracking-only, and no runtime task is present.
- [A provisional second stage escapes early] → Completion explicitly requires validated exact records before any future changes are created.

## Migration Plan

Validate all nine local proposals and Buddy artifacts. Future work executes only dependency-ready children. After all eight children archive and the final exact manifest validates, a separate proposal may create the second-stage parent and children. No production migration or rollback applies to this documentation-only parent.

## Open Questions

None. Final block and child counts are outputs of the preparation children, not open design choices for this parent.

## Testing Strategy
Change class: documentation
Seam status: not-applicable
Public behavior: none
Public seam: strict OpenSpec validation plus Buddy triage, issue-body, proposal-shape, and testing-strategy validators over the parent and eight declared children.
Existing seam reused: OpenSpec/Buddy validators for the tracking parent and child proposal shape; governance manifest CLIs belong only to executable children.
AC coverage: AC-1: proposal-shape and strict validation verify the exact eight-child inventory and exclusive capability ownership; AC-2: issue metadata and proposal review manifests verify the declared dependency graph; AC-3: strict specs and issue guardrails verify that second-stage changes are forbidden until a complete exact manifest exists.
Manual-only acceptance: none
Rationale: This tracking-only parent does not execute a CLI. Its validation covers only child declarations, dependency and proposal shape, and OpenSpec/Buddy artifacts. Synthetic fixtures, the fixed real-snapshot integration test, byte-identical repeated runs, and no-write assertions are executable-child requirements.
## ADR 0045 Boundary

Stage-one coordination does not generate, consume, or validate historical fact/event replay or backfill, learner-derived-state reconciliation, full-history decoder closure, or full-root writer equality. Such inputs are rejected as out of scope, and the declared dependency graph remains unchanged.
