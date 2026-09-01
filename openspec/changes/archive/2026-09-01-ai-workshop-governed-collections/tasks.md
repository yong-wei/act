## 1. Collection contracts and source eligibility

- [x] 1.1 Add typed governed collection envelopes and student-safe item contracts for tasks, milestones, achievements, experiments, and journals.
- [x] 1.2 Add failing unit tests for independent available/empty/unavailable states, unknown totals, deterministic ordering, stable identity, deduplication, and serialization boundaries.
- [x] 1.3 Define explicit source-type and lifecycle allowlists for each collection, including exclusions for candidates, drafts, previews represented as official results, and inferred achievements.

## 2. Server-owned collection projection

- [x] 2.1 Implement the authenticated server-only collection assembler without accepting client-controlled learner identity or collection items.
- [x] 2.2 Reuse the assignment domain and persisted Learner State path context to project published tasks and adopted path milestones with stable navigation.
- [x] 2.3 Reuse governed portfolio evidence, growth records, `SimulationLog`, and `ArenaSubmission` projectors to produce eligible experiments, achievements, and journals without raw payload exposure.
- [x] 2.4 Isolate source failures so each collection retains its own state, limitation, total, and adjacent action while route-level authentication remains fail closed.
- [x] 2.5 Add authorization and mixed-source regression tests proving other learners' records, client parameters, unconfirmed candidates, editable drafts, and ineligible source records are excluded.

## 3. AI Workshop integration

- [x] 3.1 Read governed collections in `src/app/ai/page.tsx` and pass the serializable projection to `PersonalLearningCenter` without internal HTTP calls.
- [x] 3.2 Update task, compass, achievement, experiment, and journal panels to render records and independent empty/unavailable states from the governed projection rather than production default arrays.
- [x] 3.3 Preserve report-feedback task intent and prove opening or refreshing `/ai` does not mutate LearningFact, portraits, task completion, grades, rankings, achievements, or draft lifecycle.
- [x] 3.4 Add component and route tests for populated, empty, unavailable, and mixed-state pages, including real adjacent-action destinations and student-safe source labels.

## 4. Product and delivery verification

- [x] 4.1 Add Playwright coverage for representative populated and mixed-state `/ai` flows at 1440px and 320px, including keyboard focus and horizontal-overflow checks.
- [x] 4.2 Capture Commercial UI Evidence from a clean revision-bound runtime with source/runtime proof, manifest hashes, desktop/mobile screenshots, and fail-closed drift checks.
- [x] 4.3 Run focused unit/route/component tests, affected Playwright tests, `npm run typecheck`, `openspec validate ai-workshop-governed-collections --strict`, repository change validation, and `git diff --check` on the final intended revision.
- [x] 4.4 Record verification results and the post-merge `openspec archive ai-workshop-governed-collections --yes` responsibility before delivery.
