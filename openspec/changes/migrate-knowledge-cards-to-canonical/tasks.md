## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`, `publish-core-teaching-prerequisites`.

## 1. Inventory and crosswalk

- [ ] 1.1 Inventory all active and legacy card files with card IDs, old graph IDs, source hashes, review status, and usage references.
- [ ] 1.2 Generate deterministic old-ID-to-Canonical crosswalk and classify one-to-one, duplicate, split, unmapped, and course-specific cases.

## 2. Canonical card index

- [ ] 2.1 Update card authoring/runtime schema to require one Canonical ID and build `canonicalId -> active card` index.
- [ ] 2.2 Auto-migrate exact 1:1 cards and record author decisions for duplicate/split/unmapped cases.
- [ ] 2.3 Add duplicate-active, missing-optional, required-core, and legacy-ID-write rejection tests.

## 3. Consumer references and fallback

- [ ] 3.1 Change interactive step resolution to `step -> canonicalId -> optional card` while preserving other resource fallback.
- [ ] 3.2 Add legacy fallback telemetry and verify old IDs remain read-only compatibility inputs.
- [ ] 3.3 Prove only `cardPolicy: REQUIRED` core records gate and optional card absence does not block a node/path.

## 4. Verification

- [ ] 4.1 Run focused card inventory, crosswalk, index, ResourceNode, RAG provenance, and fallback tests.
- [ ] 4.2 Run `rtk openspec validate migrate-knowledge-cards-to-canonical --type change --strict` and `rtk openspec validate --changes --strict`.
