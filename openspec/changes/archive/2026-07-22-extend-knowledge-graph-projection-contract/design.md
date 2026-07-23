# Design: Knowledge Graph Projection Contract

## Context

The `/knowledge` workspace is served by a three-stage pipeline: `src/lib/knowledge-graph-source.ts` (file-first, database-fallback) → `/api/knowledge/graph` progressive shards → client cache and 2D/3D renderers. The public payload types (`PublicKnowledgeGraphNode`, `PublicKnowledgeGraphLink`) are the contract boundary between data and rendering.

The ActKG project is rebuilding the knowledge base as an ontology with a published JSON Schema. Its consumer-facing artifact is a `GraphProjection` containing `ProjectedNode` (`concept_kind`, `semantic_name`, `candidate`, `source_coverage_count`) and `ProjectedLink` (`relation_type` ∈ {contains, prerequisite, association}, `direction`, `evidence_state`), bound to a `version_digest`. Two facts make adaptation cheap but not trivial:

- The existing relation contract already resolves every canonical type into family `child | post-requisite | association` and direction `parent-to-child | earlier-to-later | unordered` — semantically identical to ActKG's projection vocabulary, but at different granularity (≈35 canonical types vs. 3 projected types).
- An evidence-state derivation (`hasAvailableEvidence`) already exists for inspector provenance; it just never reaches the public link type.

Constraints: zero TypeScript errors baseline; relation-contract tests pin duplicate/reverse-identity/coverage behavior; current file/DB sources must remain byte-stable in their existing fields; no renderer changes in this change.

## Goals / Non-Goals

**Goals**
- Projection-shaped optional fields on the public payload, populated from current data where derivable (link `evidenceState`), omitted otherwise.
- An environment-gated ActKG `GraphProjection` source adapter that reuses the entire downstream pipeline (relation contract, coverage, budgets, shard versioning).
- Canonical `association` type registration and a direction-conflict precedence rule.

**Non-Goals**
- No canvas, layout, legend, inspector, or interaction changes (delegated to `encode-knowledge-graph-evidence-visuals`).
- No production data switch to ActKG; the adapter is fixture-tested and gated.
- No decomposition of `knowledge-graph-canvas.tsx` / `knowledge-graph-system.tsx`.
- No changes to root bubble packing, label policy, or inspector persistence contracts pinned by `refine-knowledge-graph-root-bubbles-and-inspector-persistence`.

## Decisions

### D1: Extend public types with optional fields instead of a parallel projection type

Add `evidenceState?` to `PublicKnowledgeGraphLink` and `semanticName? / conceptKind? / candidate? / sourceCoverageCount?` to `PublicKnowledgeGraphNode`. Optional-and-omitted keeps current sources byte-stable and lets consumers branch on presence.

*Alternative considered:* a separate `ProjectedPublicGraph*` type family. Rejected — it would fork every consumer (cache, reducers, renderers) for a difference that is purely additive.

### D2: Derive link `evidenceState` from existing evidence fields, reusing `hasAvailableEvidence` semantics

Current relations already carry rationale/evidence/source fields; the inspector derives availability from them. The server applies the same rule when building public links, so canvas and inspector never disagree. When a source carries no evidence information at all, the field is omitted — absence means "unknown", not "unavailable".

*Alternative considered:* compute evidence state client-side from provenance. Rejected — provenance is inspector-only payload; duplicating the rule in two places invites drift (the spec already forbids fabricating evidence).

### D3: Adapter lives in `knowledge-graph-source.ts` as a third source, gated by env

`UnifiedKnowledgeGraphPayload.source` gains `'actkg-projection'`; selection order becomes: env gate (`KNOWLEDGE_GRAPH_ACTKG_PROJECTION_PATH`) → file → database. The adapter validates the document against a vendored copy of the ActKG projection JSON Schema, maps fields, then hands off to the exact same relation-contract assertion, coverage check, budget clamp, and version computation as the file source. Failure of gate resolution or validation fails closed (descriptive error, no silent fallback) so a misconfigured deployment can never serve a half-migrated graph.

*Alternatives considered:* mapping in the API route (duplicates payload construction) or in the client cache (bypasses server validation and version identity). Both rejected.

### D4: Register canonical `association` type; canonical table wins direction conflicts

ActKG's three projected relation types map onto canonical types: `contains` → existing `contains`, `prerequisite` → existing `prerequisite`, `association` → **new** canonical type `association` (family `association`, direction `unordered`). Registration follows the existing CONTRACTS table pattern so dedup, reverse-identity, and strength normalization apply uniformly. If a projected link's `direction` disagrees with the canonical table, the table wins and the override is recorded in provenance — the projection is a view, not the governance truth.

*Alternative considered:* a "family-direct" channel bypassing canonical types. Rejected — it would create edges the contract tests cannot reason about and weaken duplicate protection.

### D5: Version binding via `version_digest` → `graphVersion`/`versionDigest`

The adapter sets the payload version from `version_digest` (plus release identity when available). Shard keys, the 60 s cache, and layout-coordinate invalidation then work unchanged; a digest bump behaves exactly like today's content-hash bump.

## Risks / Trade-offs

- [Adapter accepted as authoritative while ActKG schema is still evolving] → Vendor the schema snapshot into the repo fixture and validate strictly; a schema drift fails closed at load time rather than corrupting the graph. Track the ActKG release pin in the fixture header.
- [`evidenceState` derivation disagrees with inspector in edge cases] → Single shared derivation helper used by both server payload builder and inspector runtime; contract test asserts agreement on the runtime relations corpus.
- [Registering canonical `association` collides with existing raw types that map into the association family] → The canonical type is additive; existing ~30 association-family types keep their mappings. Contract tests prove no previously valid relation changes family/direction.
- [Optional fields gradually become de-facto required in consumers] → Spec mandates absence-means-unknown; TypeScript exactOptionalPropertyTypes-style tests assert current sources omit the fields.

## Migration Plan

1. Land type extensions + evidence derivation (no behavior change for current views).
2. Land canonical `association` registration with contract tests over the runtime relations corpus.
3. Land gated adapter + vendored schema + fixture; verify `KNOWLEDGE_GRAPH_ACTKG_PROJECTION_PATH` unset in all environments.
4. Rollback: revert commits; no data migration exists to reverse.

## Open Questions

- Final ActKG projection profile for ACT consumption (`act_runtime_graph`) may hide additional relation types — adapter must re-check `hidden_relation_types` handling once the profile stabilizes.
- Whether `candidate: true` nodes should be filtered server-side for learner roles or annotated and filtered client-side (lean: server-side for learners, visible in teacher review views) — confirm with data governance before the visual-encoding change relies on it.
