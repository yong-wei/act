## Context

`TeacherPrepPack` currently has candidate items, insertion targets, review state, export payloads, and insertion payloads. That model is useful but not yet a durable course-runtime overlay.

## Goals / Non-Goals

**Goals:**

- Persist enhancement packs linked to class, teacher, goal, lesson, diagnosis, and prep-pack evidence.
- Provide preview, review, activate, archive, and rollback operations.
- Merge approved overlay items into runtime rendering without editing base course content.
- Track post-class evidence and teacher feedback.

**Non-Goals:**

- Letting AI directly publish course content.
- Replacing the authoring/runtime content pipeline.
- Rewriting the entire lesson engine.

## Decisions

### Decision 1: Overlay never mutates base manifests

Enhancement packs are layered at runtime. Base course manifests and authoring content remain the source of truth.

### Decision 2: Activation is teacher-controlled

Only teacher-approved pack items can be activated. Draft, rejected, or unreviewed items can be previewed but not displayed to students.

### Decision 3: Runtime merge is auditable

Merged output should include pack id, item id, insertion point, source evidence, activation state, and rollback reference.

### Decision 4: Impact is measured after activation

Post-class evidence should link enhancement pack items to subsequent learning facts, path outcomes, grading results, or teacher observations when available.

### Decision 5: Persistence uses an indexed JSON snapshot record

`CourseEnhancementPack` is persisted as a Prisma record keyed by teacher, class,
goal, lesson, source prep pack, lifecycle status, and optional diagnosis
snapshot. Source metadata, overlay items, audit log, and teacher feedback remain
JSON snapshots so later API and reporting changes can consume the same durable
record without mutating base course manifests.

## Validation

- Unit tests cover overlay merge, insertion-point validation, activation gating, rollback, and archive.
- Runtime tests prove base manifests are not modified.
- Authorization tests prove students only see activated overlays for their class/session.
- Prisma schema validation and client generation prove the durable pack record is valid.
- `rtk openspec validate runtime-enhancement-pack-overlay --strict` passes.
