## 1. Contract fixtures and failing gates

- [x] 1.1 Mirror the exact v0.18 Manifest, Schema, Projection Profile, label-index
  schema, and bounded semantic fixtures used by adapter tests.
- [x] 1.2 Add failing tests for Bundle v2 routing, exact compound identities,
  required artifact roles, counts, label closure, profile drift, and no fallback.
- [x] 1.3 Preserve v1 fixtures and assert their accepted and rejected outcomes are unchanged.

## 2. Versioned v2 compatibility adapter

- [x] 2.1 Add a separate v2 compatibility registry with the pinned tag, source,
  raw hashes, Bundle, Release, Schema, component, Artifact, and profile identities.
- [x] 2.2 Implement typed v2 Manifest, Projection v3, profile, component,
  multilingual-label, checksum, privacy, and closure validation.
- [x] 2.3 Emit a protocol-specific storage-independent validated result preserving
  every raw artifact and recomputed statistic.
- [x] 2.4 Extend the standard router to dispatch declared v1 and v2 protocols and
  reject unknown or failed routes without cross-adapter fallback.

## 3. Verification

- [ ] 3.1 Run v2 positive and negative adapter tests plus the complete v1 bundle suite,
  including raw upstream export loading without `.git`, source tag/commit drift,
  missing source revision, raw Manifest/SHA256SUMS pins, and admission-time
  publication/source tag target checks.
- [ ] 3.2 Run import compile/type checks, lint, and affected database-backed bundle tests.
- [x] 3.3 Validate this OpenSpec change strictly; hand the stable working-tree
  revision to the parent for review without committing or pushing here.

### Accepted decision record

- [x] Sol DECIDE=A: keep the upstream Manifest immutable with only
  `source_revision`; bind the publication and source tag targets in a separate
  admission-time gate over a controlled, identity-pinned upstream Git root.
  The offline loader verifies the raw Manifest and all package contents without
  upstream Git. Its result emits only a fresh frozen
  `registeredAdmissionBinding` derived from the module registry, with
  `verifiedDuringLoad:false`; caller-supplied admission, proof, or registry
  fields are rejected, and no field is a cryptographic signature.
