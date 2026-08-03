## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`, `publish-core-teaching-prerequisites`.

## 1. Planner contract

- [ ] 1.1 Extend planner input with Authority/Projection/scope and ACT prerequisite graph identity.
- [ ] 1.2 Implement reverse REQUIRED traversal, mastered-node filtering, deterministic topological order, and RECOMMENDED annotations.
- [ ] 1.3 Add readiness tests for pathEligible, missing resources, optional cards, dangling/cycle gates, and engineering-only nodes.

## 2. Resource selection

- [ ] 2.1 Select accessible projected resources in the defined priority order and preserve ResourceNode role/provenance.
- [ ] 2.2 Return explicit path-blocked diagnostics when no resource is accessible; never emit an empty executable node.

## 3. LearningFact identity and history

- [ ] 3.1 Extend new fact writers with canonical/Authority/Projection/resource identity validation and no-dual-write behavior.
- [ ] 3.2 Implement read-time legacy crosswalk resolution and tests proving no historical backfill or mutation.

## 4. Verification

- [ ] 4.1 Run focused planner, prerequisite, readiness, ResourceNode, LearningFact writer/reader, and crosswalk tests.
- [ ] 4.2 Run `rtk openspec validate adopt-prerequisites-in-learning-path --type change --strict` and `rtk openspec validate --changes --strict`.
