## 1. Resource-set-complete provenance

- [ ] 1.1 Define the canonical resourceSet digest and `act.textbook-runtime-input-provenance.v2` parser/serializer with an explicit `authoringSourceRevision`, resourceSetId, normalized book IDs, input digest/count and generator identity; keep it distinct from bundle/runtime Release `sourceRevision` and `baseSourceRevision`.
- [ ] 1.2 Update the textbook exporter to emit v2 provenance for changed textbook corpora and update validators to compare its exact book set and revision against every runtime manifest.
- [ ] 1.3 Add cross-language fixtures and regressions for canonical resourceSet digest, duplicate/unsafe books, same-count wrong books, missing fields, invalid revision and generation-time input drift.

## 2. Hybrid index and external bundle closure

- [ ] 2.1 Validate that the hybrid index resourceSetId, exact book IDs, source revision and manifest identity match v2 provenance and all runtime book manifests.
- [ ] 2.2 Upgrade the tracked external bundle declaration to bind the v2 corpus identity while retaining strict parsing of historical v1 declarations.
- [ ] 2.3 Reopen and verify declaration, bundle, provenance, runtime and index identities during Release planning/publish source-proof validation before any OSS write; compare authoring revisions only within provenance/runtime/index and release/capture revisions only within declaration/source-proof/Release identities.
- [ ] 2.4 Preserve exact unchanged v1 external bundle inheritance for unrelated runtime changes, and reject any changed textbook prefix, declaration or bundle identity without v2 provenance.
- [ ] 2.5 Add release snapshot and publish regressions for resourceSet drift, same-count book drift, bundle/declaration digest drift, `authoringSourceRevision != application/runtime Release HEAD`, unchanged legacy inheritance and the same frozen v2 corpus inherited across an unrelated application HEAD change.

## 3. Lifecycle-bound corpus inspection

- [ ] 3.1 Add a read-only inspector for active, rollback and explicit candidate Release identities that derives textbook corpus state from one verified lifecycle, manifest and materialized view.
- [ ] 3.2 Emit only credential-safe Release state, external input identity, provenance generation, proved resourceSet/book IDs, authoring revision, input summary and runtime/index consistency.
- [ ] 3.3 Add tests proving active and rollback book sets are never unioned, exactly one state is active, lifecycle drift fails closed and reports contain no object key, path, mount, credential or signed URL.

## 4. Every-book candidate smoke

- [ ] 4.1 Replace the single catalog-entry textbook candidate smoke with deterministic validation of every v2 provenance book through catalog, structured runtime and reader projection consumers.
- [ ] 4.2 For a v1 candidate or rollback selection, enumerate books only from that immutable Release's source-proof-verified catalog/runtime manifest paths; use the set solely for consumer smoke and never synthesize resourceSet admission or borrow the active Release's book set.
- [ ] 4.3 Verify the candidate hybrid index exact book set in the same smoke batch, and additionally verify resourceSetId and `authoringSourceRevision` for v2.
- [ ] 4.4 Add activation regressions for an unchanged two-book v1 bundle inherited by an unrelated runtime candidate, re-selection of the historical seven-book v1 rollback without unioning active books, a broken non-first v1/v2 book, ambiguous catalog entry, index mismatch and preservation of prior active/rollback identities after failure.

## 5. Verification and documentation

- [ ] 5.1 Document stored, release-declared, admitted, active and rollback textbook states without treating OSS Blob presence as activation or requiring application HEAD equality.
- [ ] 5.2 Run the textbook provenance/resourceSet, external bundle, runtime release snapshot/publish, candidate activation and developer discovery regression suites plus `npm run typecheck`.
- [ ] 5.3 Validate `govern-oss-textbook-corpus-provenance` strictly, archive it after implementation, and strictly validate `structured-textbook-runtime`, `textbook-hybrid-retrieval` and `content-addressed-runtime-release-storage`.
- [ ] 5.4 Record that implementation completion does not publish or select a production runtime; any first v2 corpus Release and production activation require separate release authorization and evidence.
