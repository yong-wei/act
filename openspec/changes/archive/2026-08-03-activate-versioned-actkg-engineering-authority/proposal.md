## Why

ACT already has a validated Bundle/ReleaseSet/Repository path, but the current admitted receipt is older than the latest stable ActKG release and no immutable runtime Authority Snapshot/current pointer exists for independent engineering consumers. The engineering graph must be materialized and switchable without invoking course review.

## Series Dependencies

- Depends on: `revise-actkg-authority-boundary`.

## What Changes

- Reuse the existing standard Bundle adapter, AuthoritativeKnowledgeRepository, ReleaseSet Delta, and identity contracts to materialize the newest stable Release as an immutable Authority Snapshot.
- Add deterministic snapshot/manifest output, staged import, atomic `authority/current` pointer replacement, and one-pointer rollback.
- Keep Bundle import candidate/staged-only and selector-neutral; advance Engineering Authority only through a separate digest-checked activation transaction that atomically replaces the current pointer.
- Keep Formula, SystemModel, typed entities, exact engineering predicates, provenance summaries, and release lineage intact.
- Permit Engineering Graph and Engineering RAG to activate when Bundle integrity passes, regardless of ACT teaching projection state.
- Keep candidate/legacy compatibility and all fail-closed integrity checks; do not create a second database, re-audit ActKG semantics, or deploy remotely.

## Capabilities

### New Capabilities

None. This change extends the existing authoritative ingestion and repository contracts.

### Modified Capabilities

- `actkg-public-bundle-compatibility`: validated Bundle output is materialized as a deterministic Authority Snapshot.
- `authoritative-knowledge-release-ingestion`: accepted stable Releases are staged losslessly and never activate through import side effects.
- `authoritative-knowledge-release-delta`: Delta identity and impact metadata bind the snapshot lineage without becoming a course gate.
- `authoritative-knowledge-repository`: active Authority is resolved through an atomic immutable current pointer with rollback.

## Impact

- Existing ACT knowledge-release ingestion/import scripts, Repository readers, runtime authority directory, and engineering graph/RAG selectors.
- Snapshot manifests, hashes, release lineage, current pointer, and rollback diagnostics.
- No new Prisma table or remote deployment; existing persistence and file/runtime conventions remain authoritative.
