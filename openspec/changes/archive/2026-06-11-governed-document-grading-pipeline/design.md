## Context

`document-rubric-grading-workbench.ts` already contains TypeScript interfaces for `DocumentSubmissionAsset`, converted blocks, rubric definitions, draft grades, annotations, and writeback. Prisma currently stores only generic drafts and facts for this workflow. The change should convert the useful service contracts into durable records while preserving teacher review gating.

## Goals / Non-Goals

**Goals:**

- Persist submission assets, conversion artifacts, rubric assessments, and annotation anchors.
- Support PDF and supported Office conversion through MarkItDown with fallback precision.
- Require evidence anchors for every rubric criterion before profile writeback.
- Expose teacher and student workflow APIs with authorization and idempotency.

**Non-Goals:**

- Building a general PDF editor.
- Automatically returning unreviewed AI grades to students.
- Replacing existing LearningFact materialization.
- Solving all provider compatibility issues.

## Decisions

### Decision 1: Conversion quality determines reference precision

Converted documents can expose span, block, or page precision. The UI and writeback must disclose the precision and must not claim inline PDF evidence when only page or block evidence exists.

### Decision 2: Draft grading is useful but never authoritative

AI output produces draft criterion scores and comments. Only teacher-approved or teacher-edited assessments can be returned to students or written to learner profiles.

### Decision 3: Writeback is previewable and idempotent

Before approval writes LearningFacts, the API must expose which dimensions and evidence references will be affected. Repeated writeback for the same final assessment must not duplicate facts.

### Decision 4: Anchors are required for diagnosis-impacting feedback

A comment without a stable block/page/span anchor can be shown as general feedback, but it cannot update learner-state or diagnosis as high-confidence evidence.

## Validation

- Conversion tests cover MarkItDown success, fallback conversion, checksum preservation, and precision disclosure.
- Grading tests reject criterion grades without evidence references.
- Approval/writeback tests prove drafts do not write profiles and approved runs write idempotent LearningFacts.
- UI/API tests cover teacher review and student returned feedback authorization.
- `rtk openspec validate governed-document-grading-pipeline --strict` passes.
