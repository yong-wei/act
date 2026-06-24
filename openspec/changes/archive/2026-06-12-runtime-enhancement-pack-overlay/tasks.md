## 1. Enhancement Pack Persistence

- [x] 1.1 Define durable `CourseEnhancementPack` and pack item lifecycle contract.
- [x] 1.2 Link packs to teacher, class, goal, lesson, diagnosis snapshot, prep-pack id, evidence refs, and insertion targets.
- [x] 1.3 Add preview/review/activate/archive/rollback service functions.

## 2. Runtime Overlay Merge

- [x] 2.1 Implement runtime overlay merger that layers activated items onto base course runtime without mutating base manifests.
- [x] 2.2 Validate insertion points for lesson stage, lesson step, resource node, and class session targets.
- [x] 2.3 Ensure inactive, rejected, draft, or unauthorized overlays are omitted from student runtime.

## 3. Product Flow

- [x] 3.1 Add teacher preview and diff payloads for pack activation.
- [x] 3.2 Add activation and rollback APIs with audit metadata.
- [x] 3.3 Record teacher feedback and post-class impact references.

## 4. Verification

- [x] 4.1 Add overlay merge and insertion validation tests.
- [x] 4.2 Add authorization and lifecycle tests.
- [x] 4.3 Add regression test proving base manifests are unchanged.
- [x] 4.4 Run `rtk openspec validate runtime-enhancement-pack-overlay --strict`.
