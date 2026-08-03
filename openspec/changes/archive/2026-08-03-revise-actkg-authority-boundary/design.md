## Context

ActKG v0.12 is a published and validated upstream release (release hash `714681...`, 5,820 projection nodes, 2,837 engineering relations). ACT mirrors that release, but the admitted receipt still points at v0.9:r2. Existing Bundle compatibility, the DB-backed `AuthoritativeKnowledgeRepository`, candidate projection and ReleaseSet Delta contracts are reusable. The defect is semantic coupling: an ACT-owned CourseCoverage worklist is currently treated as if it were proof of ActKG engineering correctness.

## Series Dependencies

- Depends on: none (series root).

## Goals / Non-Goals

**Goals:**

- Define independent state machines for engineering Authority, ACT Teaching Projection, and consumers.
- Preserve all integrity and provenance checks while allowing Authority activation with an empty or unresolved teaching projection.
- Retain the historical 34-batch review evidence without letting it influence new selectors.
- Make resource binding and KAQ/teaching fallback gates local to affected consumers.

**Non-Goals:**

- Do not ingest or re-audit ActKG engineering meaning.
- Do not create the Authority Snapshot, Teaching Projection builder, new Prisma tables, editor UI, deployment process, or consumer implementation here.
- Do not rewrite historical LearningFact rows or infer teaching relations from aggregate/profile metadata.

## Decisions

### 1. Authority boundary and states

ActKG owns canonical engineering entities, formulas, system models, engineering statements, engineering predicates, and their release identity. ACT verifies package contract, supported schema, hashes, canonical-ID uniqueness, relation endpoints, and predecessor/successor continuity only. Authority may be `VALIDATED`, `ACTIVE`, or `REJECTED_INTEGRITY`.

ACT owns course/resource bindings and teaching prerequisites. Teaching Projection may be `PUBLISHED`, `REVIEW_REQUIRED`, or `NOT_PROJECTED`; its absence is valid. A consumer may be `READY`, `PINNED_PREVIOUS`, or `BLOCKED_LOCAL_DEPENDENCY`.

The declared snapshot is an immutable evidence-backed materialization, not a permanently candidate-only object. Snapshot creation and validation are selector-neutral; a separate explicit Authority activation transaction may select its exact manifest through the atomic current pointer. CourseCoverage and Teaching Projection are not prerequisites for that engineering activation.

### 2. Legacy CourseCoverage freeze

The exact 34-batch manifest, member digests, receipts, strategy version, capture revision, and verdict counts are copied once into an immutable `legacy-audit-manifest`. The manifest is provenance/audit evidence only. New Authority, Repository, Delta, and selector code MUST treat its verdicts as non-authoritative and MUST fail closed if the manifest itself is tampered with.

### 3. Gate matrix

An integrity-valid ActKG Bundle can activate Authority when no ACT teaching record exists. An unresolved or empty Teaching Projection blocks only the affected course, resource, path, KAQ, RAG, or other teaching consumer. A Bundle identity/hash/schema/endpoint failure blocks Authority and all dependent consumers. No aggregate CourseCoverage denominator or global historical closure may block engineering browsing/RAG.

The current ACT worklist denominator is the selected teaching scope only. Aggregate/profile-only upstream members without an ACT binding never enter that denominator; the historical 4,880 `DEFER` rows remain in the immutable audit manifest and cannot create a selector block.

### 4. Existing contracts remain the substrate

The change updates selectors and requirements around the existing Bundle compatibility, ReleaseSet, Delta, Repository, and canonical binding contracts. It does not introduce a second database, parallel graph, or alternative release identity. All runtime objects remain bound to one capture and explicit authority/projection IDs.

### 5. Compatibility and rollback boundary

Legacy graph/course readers remain available as compatibility fallback while later changes migrate consumers. This change only defines the authority decision and evidence shape; it does not switch production consumers or delete fallback code.

## Risks / Trade-offs

- Upstream engineering data can become active before teaching bindings exist. This is intentional; teaching consumers remain fail-closed and explicitly pinned.
- Existing callers may assume one global selector. They must receive a typed local dependency status instead of a false global block.
- Historical review artifacts are retained indefinitely as audit evidence, increasing storage but preserving reproducibility.

## Migration Plan

First materialize and hash the frozen legacy audit manifest from the existing 34 receipts. Then update selector contracts and tests to distinguish Authority and Teaching Projection states. Existing production selectors remain unchanged until dependent activation work has staged and verified new snapshots.

## Open Questions

None for this boundary change. Exact artifact paths and command names are implementation choices of dependent changes, subject to the stated identities and fail-closed behavior.
