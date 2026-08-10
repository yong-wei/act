## 1. Freeze the current release contract

- [x] 1.1 Add the explicit ReleaseSet lock entry for `root-locus-engineering-v0.1`, including controlled path, version, Schema contract hash, and release hash.
- [x] 1.2 Implement deterministic normalization and hash verification for the current Engineering Release envelope.
- [x] 1.3 Add fixtures proving Release membership follows the outer released entity lists rather than frozen object publication status.
- [x] 1.4 Record the current package's source run and source implementation commit in the import receipt, explicitly mark CTKGDataset and RevisionProposalRegistry references as unavailable, and reject inferred or fabricated lineage.

## 2. Build lossless persistence

- [x] 2.1 Add Prisma models and migration for ReleaseSet, Release, authoritative objects, relations, sources, evidence, original payloads, and import receipts.
- [x] 2.2 Add relational identity, endpoint, version, uniqueness, and governance constraints while retaining complete Schema-validated JSONB payloads.
- [x] 2.3 Implement current-Schema validation and fail closed on an unadapted future `contract_hash`.
- [x] 2.4 Implement one-transaction import with idempotent re-import and full rollback on reference or semantic conflicts.
- [x] 2.5 Enforce read-only Canonical content by omitting mutation, feedback, cross-project submission, and automatic revision endpoints.

## 3. Verify ingest gates

- [x] 3.1 Add round-trip reconstruction and normalized hash equality tests for the current package.
- [x] 3.2 Add negative tests for unlocked paths, hash drift, missing endpoints, inconsistent duplicate IDs, and partial-import prevention.
- [x] 3.3 Run the import against a clean local database and record the expected object, relation, source, and evidence counts.
- [x] 3.4 Add package-level tests proving the current Release is accepted with explicit unavailable lineage fields, fabricated CTKGDataset or registry references are rejected, and every prohibited ACT governance mutation remains unavailable.
- [x] 3.5 Run targeted tests, Prisma validation, typecheck, and strict OpenSpec validation without activating any production consumer.

## 4. Close accepted review findings

- [x] 4.1 Validate every current Release entity class against the fixed current Schema-backed contract, including required fields, types, enums, references, and additional properties.
- [x] 4.2 Fail closed on every persisted ReleaseSet, Release, lineage, receipt, count, digest, child payload, and normalized-payload drift before accepting an idempotent re-import.
- [x] 4.3 Bind the import and receipt to the clean ACT capture Git revision and ReleaseSet lock digest without substituting the upstream implementation commit.
- [x] 4.4 Reject authoritative object, relation, source mapping, source stub, and evidence stub inserts after the import receipt seals the Release.
- [x] 4.5 Add current-Schema, idempotency-drift, capture-revision, and post-receipt append regressions and rerun the focused PostgreSQL and repository gates.
