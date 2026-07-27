## 1. Establish binding identities

- [ ] 1.1 Add the stable Source/EvidenceSegment-to-ACT structural-unit Crosswalk with source version and content hash.
- [ ] 1.2 Add Canonical teaching-resource binding models with object revision, resource-segment hash, role, evidence, review state, and prompt version.
- [ ] 1.3 Separate authoritative evidence alignment APIs from ACT teaching-role binding APIs.

## 2. Implement incremental binding

- [ ] 2.1 Build node-change candidate generation against the resource segment index.
- [ ] 2.2 Build resource-change candidate generation against the Canonical object index using the same candidate-pair contract.
- [ ] 2.3 Reuse decisions when object revision, resource hash, and prompt version are unchanged and invalidate only affected pairs.
- [ ] 2.4 Publish deterministic bindings only when EvidenceSegment and atomic resource-role resolution are both unique.
- [ ] 2.5 Add isolated GPT review for semantic candidates and a human queue for disputed, conflicting, or high-impact cases.
- [ ] 2.6 Enforce endpoint, role, version, and uniqueness gates after every accepted review.

## 3. Migrate effective resources

- [ ] 3.1 Produce a dry-run inventory of all published, recommendable, path-eligible, and evidence-producing atomic resources.
- [ ] 3.2 Rebind effective resources without inheriting Legacy knowledge-node arrays.
- [ ] 3.3 Exclude drafts, disabled, archived, and non-teaching assets from the final blocking denominator.
- [ ] 3.4 Add a resource authority selector that keeps formal consumers on Legacy and exposes Canonical bindings only to shadow audit until final cutover.
- [ ] 3.5 Add negative tests proving completion of Canonical bindings cannot locally activate recommendation, path, or evidence consumers.
- [ ] 3.6 Add idempotency, partial-failure, review-isolation, and readiness-gate tests.
- [ ] 3.7 Run targeted tests, typecheck, data-quality scripts, and strict OpenSpec validation.
