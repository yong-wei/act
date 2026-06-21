## 1. Metadata Contract

- [ ] 1.1 Extend question metadata with LearningGoal, K/A/Q objective, graph node, capability, quality, difficulty, cognitive level, purpose, misconception, outcome, remediation, review, and version fields.
- [ ] 1.2 Add immutable content hash and algorithm/version rules for reviewed and generated questions.
- [ ] 1.3 Define provisional generated-question policy.
- [ ] 1.4 Require review audit fields: reviewer id or role, review timestamp, review batch id, source hash, metadata version ref, generation tool/model/prompt/version where applicable, and stale-invalidation rules.

## 2. Foundation Bank

- [ ] 2.1 Build quiz coverage matrix for the first-batch LearningGoals defined by `learning-goal-resource-baseline-completion`.
- [ ] 2.2 Create or register precheck, practice, checkpoint, and readiness-gate sets for the baseline goals.
- [ ] 2.3 Link each reviewed question to remediation ResourceNodes.
- [ ] 2.4 Mark generated-only or under-reviewed objective coverage as a limitation.
- [ ] 2.5 Emit denominator, source window, baseline matrix version, question bank version, and limitation reason for each LearningGoal/objective coverage row.

## 3. Evidence And Planner Integration

- [ ] 3.1 Persist reviewed question metadata and outcome refs with adaptive answers.
- [ ] 3.2 Map quiz outcomes to learner overlays and path readiness gates.
- [ ] 3.3 Ensure heavy-node unlocks require reviewed readiness evidence, not generated-only practice.
- [ ] 3.4 Materialize quiz evidence with question snapshot id, quiz set id, attempt/session ids, scoring/rubric version, denominator, retry policy, event source, event type, client event id where available, source log id, dedupe key, timestamps, confidence, LearningFact eligibility, and StudentCompetencySnapshot effect.
- [ ] 3.5 Ensure raw answer bodies and full question text remain outside ordinary learner-state payloads.
- [ ] 3.6 Write quiz bank artifacts to `course-content/runtime/resource-governance/kaq-quiz-foundation-coverage-matrix.json`, `kaq-quiz-foundation-reviewed-items.jsonl`, and `kaq-quiz-foundation-limitations.json`.

## 4. Verification

- [ ] 4.1 Add tests for question metadata persistence and restoration.
- [ ] 4.2 Add tests for LearningGoal quiz coverage completeness.
- [ ] 4.3 Add tests proving generated-only questions cannot unlock heavy nodes or terminal validation.
- [ ] 4.4 Add negative tests for missing review audit, missing evidence contract, duplicate attempt dedupe, retry policy, and stale question metadata.
- [ ] 4.5 Run `rtk openspec validate kaq-quiz-foundation-bank --strict`.
- [ ] 4.6 Run `rtk npm run test:unit -- src/features/adaptive-assessment/__tests__/adaptive-assessment-persistence.test.ts src/features/adaptive-learning/__tests__/kaq-quiz-coverage.test.ts`.
- [ ] 4.7 Run `rtk npm run db:evidence-source-coverage`.
- [ ] 4.8 Verify OpenSpec issue dependency metadata with `/Users/YW/Documents/Project/OpenSpec-buddy/skills/openspec-buddy/scripts/verify-issue-relationships.sh` after issue creation.
