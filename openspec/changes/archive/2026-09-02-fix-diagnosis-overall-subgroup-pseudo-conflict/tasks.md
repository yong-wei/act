## 1. Deterministic pseudo-conflict rule

- [x] 1.1 Add a deterministic detector for overall-vs-subgroup pseudo conflicts: a `班级/整体/总体…正常` statement combined with `部分/少数/个别学生…薄弱/滞后` wording must not be treated as an evidence conflict.
- [x] 1.2 Keep genuinely comparable conflicts (same student cohort, close time window, opposite directions) recognizable.

## 2. Generation-time guardrail

- [x] 2.1 Extend the diagnosis generation prompt with evidence-comparability constraints (same student scope and close time window are prerequisites for declaring a conflict).
- [x] 2.2 Validate summary and limitations before persistence; overall-vs-subgroup pseudo conflicts raise a retryable model-behavior error and the job requeues within the existing attempt budget.

## 3. History projection and recovery advice

- [x] 3.1 Historical reports stay immutable, but the projection marks pseudo-conflicted reports as「报告需重新生成」with an accurate reason instead of「证据存在冲突」.
- [x] 3.2 Real comparable conflicts keep the existing conflict presentation and teacher review prompt.

## 4. Benchmark and regression tests

- [x] 4.1 Bind the benchmark conflict scenario wording to the same student cohort and time window.
- [x] 4.2 Add regression tests for generation, worker retry classification, history projection, and the benchmark scenarios.
