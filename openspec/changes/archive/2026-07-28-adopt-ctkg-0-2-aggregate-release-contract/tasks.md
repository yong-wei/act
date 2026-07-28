## 1. Pin the CTKG 0.2 public contract

- [x] 1.1 Record one reviewed ActKG commit and vendor the exact CTKG 0.2 consumer Schema/JSON Schema, normalization rules, and artifact hashes used by ACT.
- [x] 1.2 Add `control-theory-engineering-v0.2` and its declared component packages as controlled repository inputs, including `SHA256SUMS`, release notes, projection, crosswalk, and component manifest.
- [x] 1.3 Replace the current candidate ReleaseSet lock with one aggregate member and explicit component-lineage hashes; keep the prior lock and 0.1 package as immutable historical fixtures.
- [x] 1.4 Add a contract fixture asserting 841 release entries, 744 projected nodes, 97 projected links, 1302 unique upstream crosswalk rows, nine predicates, projection endpoint closure, and aggregate membership for every crosswalk published entity.

## 2. Implement exact aggregate ingestion

- [x] 2.1 Extend the authoritative persistence envelope and Prisma migration to store public artifacts, aggregate/component identities, release entries, GraphProjection V2 nodes/links, upstream RAG references, and complete import receipts without fabricating private CTKGDataset rows.
- [x] 2.2 Isolate the existing CTKG 0.1 validator as a historical read/regression adapter and remove it from current-candidate admission.
- [x] 2.3 Implement the exact CTKG 0.2 bundle adapter with pinned Schema, raw-byte checksum, release/projection/source-dataset identity, membership, component, vocabulary, endpoint, and crosswalk schema/uniqueness/published-entity validation while preserving retrieval/citation IDs as opaque values.
- [x] 2.4 Import the complete bundle transactionally and idempotently; reject partial artifacts, inconsistent duplicates, mixed capture revisions, component drift, and unknown Schema versions.
- [x] 2.5 Persist original public artifact bytes and prove byte-for-byte reconstruction and SHA-256 equality after import.
- [x] 2.6 Generate an aggregate ingest receipt that separates carried public lineage from explicitly unavailable private lineage and keeps authoritative content read-only.

## 3. Rebase candidate Repository and projections

- [x] 3.1 Update `AuthoritativeKnowledgeRepository` candidate selectors, response identities, caches, and diagnostics to bind the aggregate ReleaseSet and projection digest without mixing historical rows.
- [x] 3.2 Adapt `act.canvas.v2`, `act.node-detail.v2`, and `act.migration-review.v1` to GraphProjection V2 while preserving exact public types, tiers, predicates, directions, families, evidence state, and role-layered fields.
- [x] 3.3 Replace runtime direction repair with pinned-contract validation and add fail-closed tests for semantic conflicts.
- [x] 3.4 Mark old release-bound inventory, crosswalk, candidate, decision, and binding outputs historical/stale for current readiness while preserving their audit records.

## 4. Rebase candidate graph and Konling

- [x] 4.1 Update the candidate graph release summary, coverage counts, `canonical_type` navigation, core/extension filters, and all nine Chinese predicate presentations for the aggregate package.
- [x] 4.2 Keep candidate and Legacy APIs isolated, retain the user switch, and make the aggregate view the migration-period default only after graph and Konling acceptance pass on the same ReleaseSet.
- [x] 4.3 Inject aggregate identity, selected object, exact relations, coverage, tier, projection digest, and teaching-semantics availability into candidate-page Konling context and focused read-only tools.
- [x] 4.4 Add negative tests proving candidate explanations do not infer missing Teaching Projection relations, read Legacy by label, create learning facts, or activate another consumer.

## 5. Verify the protocol rebase

- [x] 5.1 Add unit and database tests for clean import, duplicate import, every checksum/reference failure class, public-bundle round trip, 0.1 historical reads, and stale shadow isolation.
- [x] 5.2 Run the relevant migration and importer against a local database, then run targeted authoritative-knowledge, Repository, candidate graph, and Konling test suites.
- [x] 5.3 Run typecheck, affected data-governance checks, build, strict OpenSpec validation, and browser acceptance for candidate/Legacy switching.
- [x] 5.4 Update project documentation with the aggregate candidate contract, explicit private-data boundary, unchanged Legacy production authority, and downstream dependency gates.
