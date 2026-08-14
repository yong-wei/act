## 1. Immutable release mirror

- [x] 1.1 Add a tag-tree mirror tool that records the v0.18 publication/source
  commits, Git objects, file modes, raw hashes, Manifest, and Bundle digest.
- [x] 1.2 Mirror the complete pinned package into a controlled immutable ACT
  release directory and reject working-tree or undeclared inputs.
- [ ] 1.3 Validate the mirror through the admitted v2 adapter and record its receipt.

## 2. Candidate import and impact evidence

- [x] 2.1 Extend the standard import boundary for the typed v2 result without
  changing v1 database or file import behavior.
- [ ] 2.2 Materialize the 6,843-node / 2,811-relation staged Authority snapshot
  and preserve profiles, labels, components, metadata, and package evidence.
- [ ] 2.3 Compute the complete v0.9 to v0.18 object, type, relation, endpoint, and
  identity impact report directly from both full snapshots.
- [ ] 2.4 Retain and cross-check the upstream release diff without using it as the
  migration denominator.

## 3. Determinism and non-activation

- [ ] 3.1 Rebuild the mirror, candidate, and impact evidence twice from a clean
  capture and require byte-identical outputs. The runner preflight MUST bind
  the complete `prisma/migrations/` tree plus the disposable-database helper,
  Prisma config/client seams, V2 loader/admission schemas, and v0.9 audit
  inputs to the capture revision;
  Git-tree versus working-directory comparison MUST reject changed, deleted,
  newly added, and ignored migration files before replay.
- [ ] 3.2 Prove idempotent re-import and disposable-schema cleanup on success and failure.
- [ ] 3.3 Assert Authority, Teaching Projection, prerequisite, Authority
  domain-shard, consumer, and production marker pointers remain byte-identical
  v0.9 values.
- [ ] 3.4 Run focused adapter/import/snapshot tests, typecheck, lint, strict
  OpenSpec validation, and stable-revision review.
