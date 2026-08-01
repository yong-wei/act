# control-theory-engineering-v0.3 r2

## Release identity

- Release ID: `ctr:release:control-theory-engineering-v0.3`
- Release version: `control-theory-engineering-v0.3`
- Bundle contract: `actkg-public-bundle/1`
- Bundle revision: `2`
- CTKG Schema: `0.2.0`
- Publication type: packaging-only repair

## Fixes

- Adds a machine-readable Bundle Manifest and embedded CTKG Schema snapshot.
- Restores all three authoritative component IDs without changing semantic data.
- Adds deterministic validation evidence and complete raw-file checksums.

## Semantic invariants

The Release, three projections, projection metadata, and RAG crosswalk are
byte-identical to the legacy v0.3 publication. No object, relation, membership,
canonical identity, Release hash, or source Dataset hash changed.

## Publication boundary

The public Bundle contains no textbook body, exact quote, private model response,
credential, or local absolute path. Packaging commit and final Bundle digest are
recorded by the immutable publication tag and external release receipt.
