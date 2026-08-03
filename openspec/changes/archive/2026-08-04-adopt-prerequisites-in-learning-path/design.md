## Context

This change follows active resource projection and ACT core prerequisite publication. The planner must stop treating engineering `association` or textbook order as hard learning dependencies. It continues to use existing ResourceNode/path contracts and learner-state readers.

## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`, `publish-core-teaching-prerequisites`.

## Goals / Non-Goals

**Goals:**

- Produce explainable paths over ACT REQUIRED prerequisite edges only.
- Filter mastered nodes and choose accessible projected resources with deterministic readiness.
- Preserve identity/provenance on new facts and provide read-time historical crosswalk.

**Non-Goals:**

- Do not redesign path ranking, learning goals, or learner-state calculation.
- Do not promote RECOMMENDED or engineering relations to hard prerequisites.
- Do not backfill every historical LearningFact or create a parallel fact table.

## Decisions

### 1. Path traversal

Given a target Canonical ID, planner verifies current Authority/Projection, `pathEligible`, and scope. It reverse-traverses direct ACT_TEACHING `REQUIRED` prerequisites, removes nodes already mastered under governed learner state, and topologically sorts the remainder with stable Canonical-ID tie-breaks. RECOMMENDED edges are advisory annotations.

### 2. Resource selection

For each remaining node, planner selects at least one accessible current Teaching Projection resource by existing policy: lesson/handout, interactive practice, active card, textbook section, then other eligible resource. A node with zero accessible resources is not path-eligible and the planner returns an explicit blocked reason rather than an empty executable node.

### 3. Identity on new facts

New knowledge-scoped LearningFacts record `canonicalId`, `authorityReleaseId`, `projectionId`, and `resourceId` plus existing evidence identity. The writer rejects incomplete or candidate identities and never dual-writes Legacy. Historical facts retain their original revision and are resolved at read time through the immutable legacy crosswalk.

### 4. Compatibility

Legacy path requests lacking projection identity may use the existing compatibility adapter only when it returns an explicit fallback status; new formal path output must be Projection-bound.

## Risks / Trade-offs

- Paths may become shorter or blocked when no accessible resource exists; this is correct readiness behavior and exposes a resolvable gap.
- Read-time crosswalk adds lookup cost, but avoids unsafe mass backfill and keeps historical truth immutable.

## Migration Plan

Run planner shadow comparisons on representative goals, validate prerequisite/reachability/readiness diagnostics, then enable Projection-bound paths for selected consumers. Keep legacy path output available until activation readiness confirms fallback behavior.

## Open Questions

None. Traversal, resource order, and identity fields are fixed.
