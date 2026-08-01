## 1. Freeze the supported public contracts

- [x] 1.1 Record the reviewed `actkg-public-bundle/1`, CTKG Schema 0.2.0, Manifest, Release, Projection, Link Metadata, Crosswalk, component, validation-report and diff contract identities and raw hashes.
- [x] 1.2 Define ReleaseSet Lock v3 with explicit controlled path, Bundle/Release/Schema/Manifest identities and hashes, while retaining the prior lock as an immutable historical fixture.
- [x] 1.3 Record the upstream v0.3 r2 prerequisite: complete component Release IDs, Manifest roles/profiles/contracts, Schema snapshot, validation report, stable source commit/tag and closed checksums.
- [x] 1.4 Add the current unfixed v0.3 package as a negative fixture proving incomplete component identity cannot be accepted.

## 2. Build the router and compatibility registry

- [x] 2.1 Define Bundle, Release, ReleaseSet, Projection, Artifact and `ValidatedActKGBundle` types without Prisma or runtime DTO dependencies.
- [x] 2.2 Implement the Public Bundle Router with frozen no-Manifest historical routing, standard Manifest routing and no fallback after standard validation failure.
- [x] 2.3 Implement the compatibility registry keyed by Bundle contract, Schema version/raw hash and required Artifact role/profile/contract identities.
- [x] 2.4 Emit the six compatibility assessments with machine-readable matched identities and reasons.

## 3. Validate exact public Bundle integrity

- [x] 3.1 Validate Manifest identity, Bundle digest, raw Manifest hash, `SHA256SUMS`, Artifact hashes, byte lengths, JSONL record counts and exact disk/Manifest file-set equality.
- [x] 3.2 Enforce POSIX-relative path confinement, duplicate and case-fold collision rejection, and symbolic-link escape protection.
- [x] 3.3 Discover Artifacts by role/profile/contract/required state and preserve unknown optional Artifacts without enabling semantics.
- [x] 3.4 Validate Release membership, component identity/digest agreement and aggregate/component closure without hard-coded component counts.
- [x] 3.5 Validate every Projection independently, select exactly one registered runtime profile, and close Link Metadata one-to-one over projected relations.
- [x] 3.6 Validate unique Crosswalk triples and published-entity membership while preserving retrieval/citation identifiers as opaque values.
- [x] 3.7 Recompute all declared statistics dynamically and enforce the public/private field boundary.

## 4. Prove future-compatible behavior

- [x] 4.1 Add a positive v0.3 r2 fixture and synthetic v0.4 fixtures for content additions, relation-only updates, new components, distinct Projection membership and profile-specific/shared Metadata.
- [x] 4.2 Add positive fixtures for identical multi-profile content, unknown optional Artifacts and compatible packaging revisions.
- [x] 4.3 Add negative fixtures for every unknown contract, unknown Schema identity, path, hash, file-set, component, membership, endpoint, Metadata, Crosswalk, duplicate identity and privacy failure.
- [x] 4.4 Prove fixture-specific counts remain fixture assertions and a later compatible Release with different counts passes the same adapter.
- [x] 4.5 Prove validation is read-only and emits one deterministic `ValidatedActKGBundle` without database or selector effects.

## 5. Verify and document the intake boundary

- [x] 5.1 Run targeted unit/fixture suites, typecheck, build and strict OpenSpec validation.
- [x] 5.2 Document the ordinary compatible-release intake checklist and the exact conditions that require adapter update, Schema review or integrity rejection.
- [x] 5.3 Document that candidate persistence, ReleaseSet Delta, semantic governance and production activation are owned by downstream changes.
