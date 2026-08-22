## Context

Generated adaptive path candidates are persisted as immutable batches with stable candidate identities. The comparison UI can display and select them while preserving an existing active path. The adjustment action currently reuses the revision operation, but only ordinary generation persists a returned batch and only the generation action loads it into the comparison workspace. A revision can therefore calculate changed path data without producing a visible, durable candidate result. The runtime also records a successful revision as a path `switch`, even though no candidate selection occurred.

The change must complete adjustment without weakening the existing contracts for generation, current-path continuation, candidate comparison, deep links, refresh recovery, explicit selection, or execution.

## Goals / Non-Goals

**Goals:**

- Derive adjusted candidates from one server-resolved persisted source candidate.
- Persist materially different results as a new immutable candidate batch.
- Preserve provenance from source batch and candidate through adjustment and later selection.
- Keep the active path and execution evidence unchanged until explicit selection.
- Make the derived batch visible in the existing comparison workspace.
- Reject stale or materially unchanged results honestly.
- Keep adjustment audit separate from path-choice evidence.

**Non-Goals:**

- Automatically select or execute an adjusted candidate.
- Mutate an existing candidate batch or active `LearningPath` in place.
- Add a database migration before the derived-batch contract requires indexed fields.
- Redesign candidate ranking, comparison, or the overall learning-center layout.
- Infer an adjustment source from display labels, ordinal positions, or assistant prose.

## Decisions

### Persist adjustment as a derived immutable batch

A successful material adjustment creates a new `AdaptivePathCandidateBatch`. Its metadata records `sourceBatchId`, `sourceCandidateId`, the normalized request snapshot, the source candidate fingerprint, the active-progress version observed at request time, and a server-produced difference summary. The original batch and candidate remain unchanged.

This reuses the established candidate-batch boundary and avoids conflating generated alternatives with mutable execution state.

### Resolve the source with stable server-owned identity

The request carries a persisted batch ID and candidate ID. The server verifies learner ownership, goal scope, candidate membership, and the current source fingerprint before planning. Page-local identifiers such as `path-option-1` are presentation values only and cannot authorize or identify the source.

### Require a material governed difference

The server compares the source candidate with each adjusted result using governed node identities and ordering plus supported path metrics. Text, explanation, or score changes alone do not qualify. If no candidate differs materially, the operation returns `no_material_difference` and does not persist a successful derived batch.

### Bind async results to request and progress versions

The adjustment lifecycle includes the source batch, source candidate, normalized request identity, source fingerprint, and active-progress version. Any mismatch when a result completes makes it stale. A stale response cannot replace the visible batch, create path-choice evidence, or change execution state.

### Keep adjustment and selection as separate audited actions

Adjustment records its own tool run and outcome. It does not write a path-choice action. Only the existing candidate choice endpoint may adopt a candidate and record selection or switch evidence after the student explicitly confirms a choice.

### Reuse batch metadata before adding schema

Derived lineage and request snapshots are stored in the existing batch metadata envelope and projected through one typed server decoder. This avoids a migration while the adjustment contract is still local to candidate generation. A later change may promote fields only if query or integrity requirements demonstrate the need.

## Risks / Trade-offs

- **Metadata lineage could become weakly typed** -> Define one validated server schema and use it for persistence, reads, and tests.
- **Concurrent progress can make an adjustment obsolete** -> Bind the request to an active-progress version and fail closed on mismatch.
- **A revision can return cosmetic variants** -> Compare governed path facts before persistence and return `no_material_difference`.
- **The UI could imply adjustment changed the current path** -> Preserve the current-path module and label the derived batch as alternatives pending explicit selection.
- **Legacy candidates may lack a usable source fingerprint** -> Return an unavailable state rather than infer identity from ordinal or display text.

## Migration Plan

1. Add the typed derived-batch metadata and material-difference projection without changing the database schema.
2. Update the path-advisor revision operation to resolve a persisted source candidate and persist only valid material results.
3. Remove revision-created path-switch evidence and return the derived batch identity.
4. Update the learning center to load the returned batch and preserve stale-response guards.
5. Retain existing generation, selection, resume, deep-link, and execution paths as regression baselines.

Rollback can disable the new adjustment result path while leaving existing immutable batches and active paths intact. Derived batches already created remain readable candidate history and are not automatically applied.

## Open Questions

None.
