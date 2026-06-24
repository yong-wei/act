## 1. Tool Registry

- [x] 1.1 Register `generate_learning_path`, `revise_learning_path_options`, `select_learning_path`, `reject_learning_path_option`, `explain_learning_path_tradeoff`, and `record_path_adjustment_outcome`.
- [x] 1.2 Define permission tier, scope requirements, idempotency policy, redaction policy, and approval behavior for each tool.
- [x] 1.3 Ensure client hints may narrow but never expand user, class, course, resource, path, or privacy scope.

## 2. Planner Integration

- [x] 2.1 Connect `generate_learning_path` to registered goal generation and cold-start starter paths.
- [x] 2.2 Connect revision requests to time budget, difficulty rhythm, resource preference, checkpoint preference, external-resource permission, and natural-language intent.
- [x] 2.3 Return structured path options with comparison fields and student-safe rationale.

## 3. Audit And Memory

- [x] 3.1 Persist tool-run records before side effects with correlation id and idempotency key.
- [x] 3.2 Record selection, rejection, revision, adoption, ignored suggestions, and helpfulness feedback as governed path activity.
- [x] 3.3 Ensure Konling memory summaries never require raw private dialogue in learner-state or teacher-facing payloads.

## 4. Verification

- [x] 4.1 Add tests for permitted and rejected path-generation tool calls by role and scope.
- [x] 4.2 Add idempotency tests proving repeated generation does not duplicate active path rounds.
- [x] 4.3 Add tests proving tool outputs omit forbidden internal reason strings on student surfaces.
- [x] 4.4 Run `rtk openspec validate add-konling-path-generation-tools --strict`.
