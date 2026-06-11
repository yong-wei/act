## 1. Persistence and Conversion

- [x] 1.1 Add durable models or storage records for document submission assets, conversion artifacts, rubric assessments, and annotation anchors.
- [x] 1.2 Implement upload/submission creation with checksum, owner, assignment, class, format, and status metadata.
- [x] 1.3 Implement MarkItDown conversion with fallback adapter and page/block/span precision flags.
- [x] 1.4 Persist conversion warnings and quality flags for teacher-visible review.

## 2. Draft Grading and Review

- [x] 2.1 Add rubric assessment creation with criterion-level draft grades and evidence references.
- [x] 2.2 Reject draft grades that lack required evidence anchors or violate rubric schema.
- [x] 2.3 Add teacher review actions for approve, edit, return, and reject.
- [x] 2.4 Add writeback preview before any approved grading updates learner evidence.

## 3. Workflow Surfaces

- [x] 3.1 Add or harden APIs for submission, draft grading, review, feedback read, and writeback.
- [x] 3.2 Update teacher workbench to show conversion status, document preview, rubric tree, draft comments, editable annotations, and approval actions.
- [x] 3.3 Update student feedback surface to show returned rubric breakdown, evidence anchors, approved comments, and profile impact summary.
- [x] 3.4 Add Konling grading assistant context from persisted assessment state without allowing approve or writeback actions.

## 4. Verification

- [x] 4.1 Add conversion and persistence tests.
- [x] 4.2 Add teacher approval and writeback idempotency tests.
- [x] 4.3 Add authorization tests for teacher and student grading endpoints.
- [x] 4.4 Run `rtk openspec validate governed-document-grading-pipeline --strict`.
