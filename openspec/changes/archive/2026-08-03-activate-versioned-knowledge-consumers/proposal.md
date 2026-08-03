## Why

Authority and Teaching Projection can be built independently, but there is no local consumer-level activation contract. A single global switch would force unaffected teaching consumers to move with an Authority change and would expose half-built projection artifacts.

## Series Dependencies

- Depends on: `rebase-act-teaching-projection-incrementally`, `adopt-layered-graph-and-course-consumers`, `adopt-teaching-projection-in-konling-and-rag`, `adopt-prerequisites-in-learning-path`.

## What Changes

- Add per-consumer readiness and activation manifests for Engineering Graph/RAG, course runtime, Konling, Teaching Resource RAG, and learning path.
- Stage complete immutable Authority/Projection materializations, run shadow/readiness checks, then atomically replace one activation pointer.
- Allow engineering consumers to switch first while affected teaching consumers remain pinned to the previous combination.
- Record current/previous combinations, impact, fallback/shadow evidence, and rollback target.
- Keep this as a local activation/readiness change; no remote deployment or simultaneous legacy retirement.

## Capabilities

### New Capabilities

- `versioned-knowledge-consumer-activation`: Consumer readiness, staged complete manifests, atomic activation, shadow, and rollback contract.

### Modified Capabilities

None. Consumer-specific graph/Konling/path behavior is defined by the preceding changes.

## Impact

- Local runtime activation manifest/current pointer, consumer readiness tests, staged projection directories, and rollback diagnostics.
- No server deployment, database migration, upstream re-review, or deletion of legacy readers.
