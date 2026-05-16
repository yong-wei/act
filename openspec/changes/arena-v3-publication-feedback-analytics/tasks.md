## 1. Teacher Publication Reports

- [ ] 1.1 Add publication report analytics functions for participation, submissions, validity, score distribution, hard constraints, weak metrics, methods, non-submitters, personal bests, and excellent solutions.
- [ ] 1.2 Add authorized data access for a single publication report scoped by publicationId, classId, and teacher/admin actor.
- [ ] 1.3 Add `/teacher/arena/publications/[publicationId]/page.tsx` and report UI.
- [ ] 1.4 Add report links to persisted publication rows on `/teacher/arena`.
- [ ] 1.5 Add tests for owned publication, unauthorized publication, empty state, and cross-class leakage.

## 2. Student Diagnostic Feedback

- [ ] 2.1 Add `src/features/arena/student/arena-feedback-rules.ts` with white-box and black-box feedback classification.
- [ ] 2.2 Add `src/features/arena/student/arena-personal-feedback.tsx` for reusable rendering.
- [ ] 2.3 Integrate shared feedback into the white-box Arena submission panel.
- [ ] 2.4 Integrate shared feedback into the black-box Arena submission panel.
- [ ] 2.5 Add tests for valid ranking, hard-constraint failure, personal-best improvement, regression, energy-heavy submissions, and hidden black-box privacy.

## 3. Arena Evidence Consumption

- [ ] 3.1 Add student Arena summary analytics from persisted submissions and optional LearningFact context.
- [ ] 3.2 Add class Arena summary analytics from class/publication-scoped submissions and optional LearningFact context.
- [ ] 3.3 Extend `/api/user/profile` with the new Arena summary while preserving existing `ArenaStudentPortfolio` compatibility.
- [ ] 3.4 Extend teacher class insight response with a nested Arena summary.
- [ ] 3.5 Add tests for valid, invalid, and non-submitting students.

## 4. Verification

- [ ] 4.1 Run targeted Arena feedback and analytics unit tests.
- [ ] 4.2 Run teacher Arena route and profile route tests.
- [ ] 4.3 Run `rtk npm run test:unit -- src/features/arena src/lib/data-governance`.
- [ ] 4.4 Run `rtk npm run lint`.
