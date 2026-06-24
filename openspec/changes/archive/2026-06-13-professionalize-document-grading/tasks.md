## 1. Rubric and Evaluator Contract

- [x] 1.1 Define control-correction rubric v1 with criteria, levels, evidence requirements, and writeback mapping.
- [x] 1.2 Add a draft evaluator adapter contract with schema validation, evidence anchor validation, and deterministic test adapter.
- [x] 1.3 Replace scaffold middle-level draft grading for competition grading paths with evaluator-derived criterion assessments.

## 2. Teacher Review and Feedback

- [x] 2.1 Preserve AI draft and teacher-approved criterion values for diff and audit.
- [x] 2.2 Add blocked, retry, edited, approved, returned, and rejected workbench states where missing.
- [x] 2.3 Add student feedback action cards linked to learner-record, path, practice, or resource destinations.

## 3. Metrics and Writeback

- [x] 3.1 Add grading quality metrics for override rate, AI/teacher score delta or agreement, blocked evaluator outputs, feedback coverage, and sample size.
- [x] 3.2 Include grading quality metrics in assistant effect-report exports.
- [x] 3.3 Ensure approved writeback remains idempotent and audit-backed.

## 4. Verification

- [x] 4.1 Add tests for invalid evaluator output blocking writeback.
- [x] 4.2 Add tests for teacher edit diff preservation and student action-card visibility.
- [x] 4.3 Run focused document grading and effect-report tests.
- [x] 4.4 Run `rtk openspec validate professionalize-document-grading --strict`.
