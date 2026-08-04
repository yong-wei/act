## Context

The preceding changes provide layered consumers, Konling/RAG integration, and Projection-bound paths. Activation must coordinate them without making a projection's readiness claims stronger than the artifacts/tests that support them. The existing runtime directory synchronization can carry staged files; this change only defines local manifests and pointers.

## Series Dependencies

- Depends on: `rebase-act-teaching-projection-incrementally`, `adopt-layered-graph-and-course-consumers`, `adopt-teaching-projection-in-konling-and-rag`, `adopt-prerequisites-in-learning-path`.

## Goals / Non-Goals

**Goals:**

- Represent readiness and version combinations independently per consumer.
- Ensure staged output is complete and immutable before any pointer changes.
- Support engineering-first activation, teaching pinning, shadow comparison, and pointer rollback.

**Non-Goals:**

- Do not deploy remotely or alter server/container state.
- Do not delete fallback/legacy runtime or retire old IDs.
- Do not add a global transaction spanning unrelated consumer data stores.

## Decisions

### 1. Consumer manifest

`activation.json` maps named consumers to Authority release, optional Projection ID/scope, manifest hashes, readiness state, activation timestamp/revision, and prior combination. Each consumer has `READY`, `PINNED_PREVIOUS`, `BLOCKED_LOCAL_DEPENDENCY`, or `SHADOW` status. Unknown states fail closed.

### 2. Staged completeness

Activation input is a staged directory containing complete Authority Snapshot, Projection artifacts, card index, prerequisite output, and impact/readiness manifests required by that consumer. Validators check file set, hashes, cross-artifact identities, route/resource smoke checks, and no unresolved local blockers before pointer replacement.

### 3. Atomic per-consumer switch

Build a new full activation manifest in a temporary path, validate it, then atomically replace the pointer. A change may update engineering consumers while leaving affected teaching consumers on their prior combination; the pointer records both states. No consumer reads a half-written manifest.

### 4. Shadow and rollback

Shadow mode compares representative old/new responses, fallback hits, citation/projection identities, and path readiness without mutating learner facts. The previous activation manifest is retained; rollback is a digest-checked atomic pointer replacement. Consumer rollback does not delete new snapshots.

## Risks / Trade-offs

- Mixed consumer versions require clear diagnostics, but that is safer than a global cutover.
- Local readiness tests can miss remote packaging issues; remote deployment is explicitly outside this change and remains a separate gate.

## Migration Plan

Generate a staged manifest from current local artifacts, run per-consumer readiness/shadow checks, switch Engineering Graph/RAG first if clean, keep affected teaching consumers pinned, and verify rollback. Leave legacy runtime intact.

## Open Questions

None. Activation is local and per-consumer by design.
