## 1. Implementation

- [ ] 1.1 Extract focused black-box preset subcomponents where needed.
- [ ] 1.2 Add experiment budget and coverage calculation.
- [ ] 1.3 Add nominal-model confidence and preview mismatch summaries.
- [ ] 1.4 Update black-box submission feedback to explain hidden evaluation boundaries.
- [ ] 1.5 Reuse existing persistence unless a narrow schema addition is justified.

## 2. Tests

- [ ] 2.1 Add black-box budget and coverage tests.
- [ ] 2.2 Add privacy tests for hidden scenario explanations.
- [ ] 2.3 Add UI tests for preview versus official evaluation messaging.

## 3. Verification

- [ ] 3.1 Run targeted black-box Arena/workbench tests.
- [ ] 3.2 Run Prisma validation if schema changes.
- [ ] 3.3 Run `npm run lint`.
- [ ] 3.4 Run `npm run build` if route rendering or schema codegen changes.

## 4. Coordination

- [ ] 4.1 Depends on `workbench-evidence-explanations` and `arena-result-feedback-explainer`.
- [ ] 4.2 Do not expose hidden evaluation details or implement general honors here.
