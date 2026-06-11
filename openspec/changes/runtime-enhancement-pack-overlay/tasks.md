## 1. Enhancement Pack Persistence

- [ ] 1.1 Define durable `CourseEnhancementPack` and pack item lifecycle contract.
- [ ] 1.2 Link packs to teacher, class, goal, lesson, diagnosis snapshot, prep-pack id, evidence refs, and insertion targets.
- [ ] 1.3 Add preview/review/activate/archive/rollback service functions.

## 2. Runtime Overlay Merge

- [ ] 2.1 Implement runtime overlay merger that layers activated items onto base course runtime without mutating base manifests.
- [ ] 2.2 Validate insertion points for lesson stage, lesson step, resource node, and class session targets.
- [ ] 2.3 Ensure inactive, rejected, draft, or unauthorized overlays are omitted from student runtime.

## 3. Product Flow

- [ ] 3.1 Add teacher preview and diff payloads for pack activation.
- [ ] 3.2 Add activation and rollback APIs with audit metadata.
- [ ] 3.3 Record teacher feedback and post-class impact references.

## 4. Verification

- [ ] 4.1 Add overlay merge and insertion validation tests.
- [ ] 4.2 Add authorization and lifecycle tests.
- [ ] 4.3 Add regression test proving base manifests are unchanged.
- [ ] 4.4 Run `rtk openspec validate runtime-enhancement-pack-overlay --strict`.
