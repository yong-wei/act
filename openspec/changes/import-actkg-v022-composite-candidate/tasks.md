## 1. Immutable composite envelope mirror

- [ ] 1.1 Extend the tag-tree mirror tooling to resolve the pinned
  `control-theory-engineering-v0.22` publication and record its publication and
  source commits, Git objects, file modes, raw hashes, Component Manifest, and
  envelope digest.
- [ ] 1.2 Mirror the complete envelope — the Aggregate plus every
  manifest-locked component (Integration v0.20, Chinese terminology v0.5,
  Schema, Projection Profile, tag index, and the remaining declared
  components) — into a controlled immutable ACT release directory and reject
  working-tree, undeclared, or non-manifest inputs.
- [ ] 1.3 Verify the declared protocol is `actkg-public-bundle/2` and Schema
  `0.3.0` with a schema hash equal to the admitted v0.18 hash; fail closed on
  any difference. Then validate the mirror through the reused v2 adapter and
  record explicit v0.22 registration, validation, and admission receipts under
  the `(bundleContractVersion, bundleDigest)` identity.

## 2. Candidate import and impact evidence

- [ ] 2.1 Reuse the standard v2 import boundary for the validated v0.22 result
  without changing v1 or v0.18 database or file import behavior.
- [ ] 2.2 Materialize the staged Authority snapshot whose visible membership is
  exactly the manifest-declared runtime Projection with complete endpoint
  closure; record the resolved object, relation, and label counts in the intake
  receipt instead of hard-coding them, and preserve profiles, labels,
  components, crosswalks, metadata, and envelope evidence as separately hashed
  records.
- [ ] 2.3 Compute the complete v0.18 to v0.22 object, type, relation, endpoint,
  and identity impact report directly from the current v0.18 production
  snapshot and the full v0.22 candidate snapshot.
- [ ] 2.4 Retain and cross-check the upstream intermediate release diffs
  (v0.19 through v0.22) without using them as the migration denominator; a
  disagreement with the direct v0.18-to-v0.22 audit is recorded as evidence.

## 3. Determinism and non-activation

- [ ] 3.1 Rebuild the mirror, candidate, and impact evidence twice from a clean
  capture and require byte-identical outputs, including identical resolved
  membership counts. Reuse the v0.18 capture closure and two-commit
  source/derived contract with v0.22 release identifiers, capture roots, and
  the v0.18 baseline inputs; exact Git-file checks MUST reject changed,
  deleted, added, ignored, mode-drifted, and untracked closure members before
  replay and again before publication, and late drift MUST remove the partial
  output root and leave no candidate receipt.
- [ ] 3.2 Prove idempotent re-import of the same envelope and disposable-schema
  cleanup on success and failure.
- [ ] 3.3 Assert Authority, Teaching Projection, prerequisite, Chinese-display,
  Authority domain catalog/shard, consumer-activation, and production marker
  selectors remain byte-identical to their current v0.18 values.
- [ ] 3.4 Run focused adapter/import/snapshot tests, typecheck, lint, strict
  OpenSpec validation, and stable-revision review.
