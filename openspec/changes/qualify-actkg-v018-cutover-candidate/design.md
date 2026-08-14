## Context

The Authority candidate, localized display layer, and Teaching Projection are
produced by independent changes. Qualification is the first stage that proves
their joint behavior for all six versioned consumers while real production
pointers still select v0.9.

## Goals / Non-Goals

**Goals:**

- Freeze one complete v0.18 cutover candidate and its v0.9 rollback set.
- Prove graph, display, teaching, consumer, determinism, and rollback behavior.
- Emit a binary READY/BLOCKED handoff for runtime publication.

**Non-Goals:**

- Building or deploying a production image.
- Modifying any real current pointer or production marker.
- Treating incomplete future teaching enrichment as a blocker.

## Decisions

### 1. Qualify one compound release-set identity

The qualification manifest pins the application capture, v0.18 Bundle and
snapshot, localized-label artifact, Teaching Projection, prerequisite
publication, composed Authority domain-shard set, six consumer records, and
every v0.9 predecessor. Mixed identities or unsealed inputs are rejected before
queries run.

### 2. Recompute the full migration audit

Qualification verifies release membership, 6,843 runtime nodes, 2,811
relations, 1,909 admitted label rows, object/relation endpoint closure, and the
complete v0.9 to v0.18 impact report. It does not rely solely on the upstream
v0.17 to v0.18 delta.

### 3. Use behavior matrices rather than aggregate status

The matrix covers graph root/domain/family/neighborhood/detail reads, Chinese
preferred and fallback labels, no-system-string checks, engineering and
teaching RAG, Konling, active course resources, prerequisites, learning paths,
cards, and infographs. Each result records exact input identities and bounded
diagnostics.

### 4. Require existing-reference closure, not complete teaching enrichment

Every captured ACT teaching reference must resolve with zero unresolved
mapping. New v0.18 nodes may have no ACT teaching relation. Declared
terminology rows must validate, but the number of localized nodes is a coverage
metric rather than an Authority cutover threshold.

### 5. Rehearse rollback outside real stores

An isolated control root starts from all five copied v0.9 selectors, advances
to the exact candidate through existing transaction APIs, proves the composed
shard and all six reads, and returns to byte-identical v0.9 selectors. Before
and after hashes prove real stores were not touched.

### 6. Produce an immutable publication gate

The signed readiness report is READY only when two independent clean rebuilds
match and every required audit, query, consumer, and rollback check passes. It
authorizes runtime publication only; it is not cutover authorization.

## Risks / Trade-offs

- Qualification can be expensive, but it runs once on a stable candidate.
- Query fixtures must avoid encoding IDs into learner-visible expected output.

## Migration Plan

1. Assemble and seal the compound manifest.
2. Run deterministic rebuild, audit, and query matrices.
3. Exercise isolated activation and rollback.
4. Emit READY or a concrete BLOCKED report without touching production.

## Open Questions

- None. Production evidence is deliberately deferred to runtime publication.
