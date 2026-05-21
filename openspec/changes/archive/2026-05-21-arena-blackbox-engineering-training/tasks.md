## 1. Implementation

- [x] 1.1 Extract focused black-box preset subcomponents where needed.
- [x] 1.2 Add experiment budget and coverage calculation.
- [x] 1.3 Add nominal-model confidence and preview mismatch summaries.
- [x] 1.4 Update black-box submission feedback to explain hidden evaluation boundaries.
- [x] 1.5 Reuse existing persistence unless a narrow schema addition is justified.

## 2. Tests

- [x] 2.1 Add black-box budget and coverage tests.
- [x] 2.2 Add privacy tests for hidden scenario explanations.
- [x] 2.3 Add UI tests for preview versus official evaluation messaging.

## 3. Verification

- [x] 3.1 Run targeted black-box Arena/workbench tests.
- [x] 3.2 Run Prisma validation if schema changes.
- [x] 3.3 Run `npm run lint`.
- [x] 3.4 Run `npm run build` if route rendering or schema codegen changes.

## 4. Coordination

- [x] 4.1 Depends on `workbench-evidence-explanations` and `arena-result-feedback-explainer`.
- [x] 4.2 Do not expose hidden evaluation details or implement general honors here.
