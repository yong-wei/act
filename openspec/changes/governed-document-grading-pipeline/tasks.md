## 1. Persistence and Conversion

- [ ] 1.1 Add durable models or storage records for document submission assets, conversion artifacts, rubric assessments, and annotation anchors.
- [ ] 1.2 Implement upload/submission creation with checksum, owner, assignment, class, format, and status metadata.
- [ ] 1.3 Implement MarkItDown conversion with fallback adapter and page/block/span precision flags.
- [ ] 1.4 Persist conversion warnings and quality flags for teacher-visible review.

## 2. Draft Grading and Review

- [ ] 2.1 Add rubric assessment creation with criterion-level draft grades and evidence references.
- [ ] 2.2 Reject draft grades that lack required evidence anchors or violate rubric schema.
- [ ] 2.3 Add teacher review actions for approve, edit, return, and reject.
- [ ] 2.4 Add writeback preview before any approved grading updates learner evidence.

## 3. Workflow Surfaces

- [ ] 3.1 Add or harden APIs for submission, draft grading, review, feedback read, and writeback.
- [ ] 3.2 Update teacher workbench to show conversion status, document preview, rubric tree, draft comments, editable annotations, and approval actions.
- [ ] 3.3 Update student feedback surface to show returned rubric breakdown, evidence anchors, approved comments, and profile impact summary.
- [ ] 3.4 Add Konling grading assistant context from persisted assessment state without allowing approve or writeback actions.

## 4. Verification

- [ ] 4.1 Add conversion and persistence tests.
- [ ] 4.2 Add teacher approval and writeback idempotency tests.
- [ ] 4.3 Add authorization tests for teacher and student grading endpoints.
- [ ] 4.4 Run `rtk openspec validate governed-document-grading-pipeline --strict`.
