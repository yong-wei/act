## Why

Teacher prep-pack generation already creates reviewable candidate interventions, but the assistant closed loop is not complete until approved interventions can be previewed, activated, and later rolled back as a runtime overlay. Directly modifying base course manifests would make generated content hard to audit and risky to deploy.

## What Changes

- Persist `CourseEnhancementPack` records that wrap approved prep-pack items.
- Add preview, review, activate, archive, and rollback lifecycle states.
- Merge activated packs into course runtime as overlays without mutating the base manifest.
- Record post-class evidence so enhancement impact can be evaluated.

## Capabilities

### Modified Capabilities

- `teacher-prep-pack-generation`
- `resource-node-registry`
- `simulation-course-resource-integration`
- `course-data-quality-gates`

## Impact

- Depends on diagnosis surfaces and RAG authority metadata for credible prep-pack evidence.
- Adds runtime overlay behavior and review APIs.
- Does not allow unreviewed AI suggestions to change student course runtime.
