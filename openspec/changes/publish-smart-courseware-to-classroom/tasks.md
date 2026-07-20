## 1. Publication evidence and versions

- [x] 1.1 Add persistence for content-hash-bound static/browser receipts, individual teaching-goal/module source-gap acknowledgements, stale-plan acknowledgements, and immutable courseware revisions.
- [x] 1.2 Integrate shared static and browser validators with publication-only activity, answer-leakage, the shared canonical goal/module source-state values, stable upstream gap identities, AI-label, and plan-baseline checks.
- [x] 1.3 Invalidate whole-draft receipts when their content hash changes and invalidate individual acknowledgements only when their bound stable gap identity changes, while keeping AI review advisory.
- [x] 1.4 Implement sequential `互动课件第N版（基于教案第M版）` publication and immutable revision history.
- [x] 1.5 Add cross-child contract tests proving both pending lineage states flow from approved goals and edited modules into publication; plan approval, editor review, whole-course approval, and projection create no acknowledgement; each gap requires explicit individual acknowledgement; unrelated plan/sibling/order changes preserve unchanged gap acknowledgements while invalidating whole-draft receipts; and target content/source/state/delete-recreate changes invalidate prior acknowledgements through a new gap identity.

## 2. Catalog projection and classroom binding

- [x] 2.1 Transactionally project published revisions into governed `LessonPlan`, `LessonItem`, and `TeachingResource` records.
- [x] 2.2 Add exact generated-courseware revision and manifest-hash binding to `ClassSession` while preserving legacy `planId` launch behavior.
- [x] 2.3 Make student runtime resolve the bound immutable revision and fail with integrity recovery rather than substituting the newest version.
- [x] 2.4 Add teacher/class ownership, preparation, active-class, finalization, and session-integrity tests for generated sessions.

## 3. P0 demonstration and acceptance

- [ ] 3.1 Add deterministic end-to-end acceptance from Konling natural-language task creation through ambiguity clarification, multi-turn constraint revision, demo source import, plan, courseware, zero unresolved source gaps, three authoritative content-quality comparisons, validation, publication, catalog, classroom, and student interaction.
- [ ] 3.2 Record a manual real-provider 45-minute root-locus demonstration with the same natural-language and source-completeness path, and identify any fallback revision as previously generated.
- [ ] 3.3 Add desktop/mobile and light/dark teacher/student browser acceptance for publication and classroom states.
- [x] 3.4 Update project, operator, provider, privacy, and contest-demonstration documentation for P0.
- [ ] 3.5 Run targeted API/Playwright/migration tests, typecheck, relevant build gates, and strict OpenSpec validation; record AC evidence.
