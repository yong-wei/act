## 1. Freeze the current release contract

- [ ] 1.1 Add the explicit ReleaseSet lock entry for `root-locus-engineering-v0.1`, including controlled path, version, Schema contract hash, and release hash.
- [ ] 1.2 Implement deterministic normalization and hash verification for the current Engineering Release envelope.
- [ ] 1.3 Add fixtures proving Release membership follows the outer released entity lists rather than frozen object publication status.
- [ ] 1.4 Record the current package's source run and source implementation commit in the import receipt, explicitly mark CTKGDataset and RevisionProposalRegistry references as unavailable, and reject inferred or fabricated lineage.

## 2. Build lossless persistence

- [ ] 2.1 Add Prisma models and migration for ReleaseSet, Release, authoritative objects, relations, sources, evidence, original payloads, and import receipts.
- [ ] 2.2 Add relational identity, endpoint, version, uniqueness, and governance constraints while retaining complete Schema-validated JSONB payloads.
- [ ] 2.3 Implement current-Schema validation and fail closed on an unadapted future `contract_hash`.
- [ ] 2.4 Implement one-transaction import with idempotent re-import and full rollback on reference or semantic conflicts.
- [ ] 2.5 Enforce read-only Canonical content by omitting mutation, feedback, cross-project submission, and automatic revision endpoints.

## 3. Verify ingest gates

- [ ] 3.1 Add round-trip reconstruction and normalized hash equality tests for the current package.
- [ ] 3.2 Add negative tests for unlocked paths, hash drift, missing endpoints, inconsistent duplicate IDs, and partial-import prevention.
- [ ] 3.3 Run the import against a clean local database and record the expected object, relation, source, and evidence counts.
- [ ] 3.4 Add package-level tests proving the current Release is accepted with explicit unavailable lineage fields, fabricated CTKGDataset or registry references are rejected, and every prohibited ACT governance mutation remains unavailable.
- [ ] 3.5 Run targeted tests, Prisma validation, typecheck, and strict OpenSpec validation without activating any production consumer.
