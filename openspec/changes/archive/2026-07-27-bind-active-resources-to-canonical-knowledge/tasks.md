## 1. Establish binding identities

- [x] 1.1 Add the stable Source/EvidenceSegment-to-ACT structural-unit Crosswalk with source version and content hash.
- [x] 1.2 Add Canonical teaching-resource binding models with object revision, resource-segment hash, role, evidence, review state, and prompt version.
- [x] 1.3 Separate authoritative evidence alignment APIs from ACT teaching-role binding APIs.

## 2. Implement incremental binding

- [x] 2.1 Build node-change candidate generation against the resource segment index.
- [x] 2.2 Build resource-change candidate generation against the Canonical object index using the same candidate-pair contract.
- [x] 2.3 Reuse decisions when object revision, resource hash, and prompt version are unchanged and invalidate only affected pairs.
- [x] 2.4 Publish deterministic bindings only when EvidenceSegment and atomic resource-role resolution are both unique.
- [x] 2.5 Add isolated GPT review for semantic candidates and a human queue for disputed, conflicting, or high-impact cases.
- [x] 2.6 Enforce endpoint, role, version, and uniqueness gates after every accepted review.

## 3. Migrate effective resources

- [x] 3.1 Produce a dry-run inventory of all published, recommendable, path-eligible, and evidence-producing atomic resources.
- [x] 3.2 Rebind effective resources without inheriting Legacy knowledge-node arrays.
- [x] 3.3 Exclude drafts, disabled, archived, and non-teaching assets from the final blocking denominator.
- [x] 3.4 Add a resource authority selector that keeps formal consumers on Legacy and exposes Canonical bindings only to shadow audit until final cutover.
- [x] 3.5 Add negative tests proving completion of Canonical bindings cannot locally activate recommendation, path, or evidence consumers.
- [x] 3.6 Add idempotency, partial-failure, review-isolation, and readiness-gate tests.
- [x] 3.7 Run targeted tests, typecheck, data-quality scripts, and strict OpenSpec validation.

## 4. Close accepted remediation findings

- [x] 4.1 Correct runtime and TeachingResource inventory semantics, including audited path targets, complete evidence contracts, ordinary-placement aggregation, PAUSED delivery, and publication revision identity.
- [x] 4.2 Separate stable pair and versioned attempt identities; bind isolated review caches to exact whitelist inputs and deterministic high-impact policy.
- [x] 4.3 Bind publication to the exact validated ACT Crosswalk endpoint and enforce append-only supersession, immutable human queues, sealed publication, and auditable human receipts in PostgreSQL.
- [x] 4.4 Make verify-only reconstruct the current APP_REVISION baseline and fail on stale, incomplete, drifted, or unexpectedly populated states.
