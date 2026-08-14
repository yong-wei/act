## 1. Contract fixtures and failing gates

- [ ] 1.1 Mirror the exact v0.18 Manifest, Schema, Projection Profile, label-index
  schema, and bounded semantic fixtures used by adapter tests.
- [ ] 1.2 Add failing tests for Bundle v2 routing, exact compound identities,
  required artifact roles, counts, label closure, profile drift, and no fallback.
- [ ] 1.3 Preserve v1 fixtures and assert their accepted and rejected outcomes are unchanged.

## 2. Versioned v2 compatibility adapter

- [ ] 2.1 Add a separate v2 compatibility registry with the pinned tag, source,
  raw hashes, Bundle, Release, Schema, component, Artifact, and profile identities.
- [ ] 2.2 Implement typed v2 Manifest, Projection v3, profile, component,
  multilingual-label, checksum, privacy, and closure validation.
- [ ] 2.3 Emit a protocol-specific storage-independent validated result preserving
  every raw artifact and recomputed statistic.
- [ ] 2.4 Extend the standard router to dispatch declared v1 and v2 protocols and
  reject unknown or failed routes without cross-adapter fallback.

## 3. Verification

- [ ] 3.1 Run v2 positive and negative adapter tests plus the complete v1 bundle suite.
- [ ] 3.2 Run import compile/type checks, lint, and affected database-backed bundle tests.
- [ ] 3.3 Validate this OpenSpec change strictly and submit the stable revision for review.
