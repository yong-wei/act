## 0. Prerequisite Gate

- [ ] 0.1 Confirm `standardize-simulation-scene-and-trace-protocol` has no remaining tasks, passes strict validation, and exposes consumable `SceneSpec`, `EvaluationSpec`, and `SimulationTrace` contracts.
- [ ] 0.2 Confirm `make-simulation-runtime-replayable` has no remaining tasks, passes strict validation, and exposes replay references/checksums required by governed features.
- [ ] 0.3 Confirm `govern-simulation-and-arena-evidence-sources` has no remaining tasks, passes strict validation, and exposes simulation/Arena evidence lineage and compact `LearningFact.contextJson` contracts.
- [ ] 0.4 Confirm `unify-arena-preview-adapter-and-model-registry` has no remaining tasks, passes strict validation, and exposes preview adapter/model registry ids needed by ResourceNodes.
- [ ] 0.5 Confirm `register-simulations-as-course-resources` has no remaining tasks, passes strict validation, and exposes course-launchable simulation/Arena registry ids and launch context.
- [ ] 0.6 Confirm `split-simulation-scene-shells` has no remaining tasks, passes strict validation, and preserves render/launch targets for ResourceNode backfill.
- [ ] 0.7 Confirm `materialize-simulation-features-for-personalization` has no remaining tasks, passes strict validation, and exposes simulation/Arena feature groups for this change to consume rather than redefine.
- [ ] 0.8 Audit the target merged specs for `student-evidence-feature-cache`, `evidence-driven-personalization`, and `teacher-evidence-governance` so prerequisite simulation/Arena scenarios remain intact before adaptive-learning additions are implemented.

## 1. Stage 1 MVP Contracts and Data Model

- [ ] 1.1 Add Prisma models or migrations for learner state snapshots, knowledge mastery, resource preferences, ResourceNodes, ResourceNode edges, learning plans, learning plan nodes, path feedback, agent memory, persistent intervention outcomes, privacy audit records, and assessment persistence.
- [ ] 1.2 Define TypeScript contracts for learner state, ResourceNode, path plan, path explanation, Konling memory, intervention, privacy classification, evaluation events, and teacher ResourceNode management payloads.
- [ ] 1.3 Add feature flags for learner-state service, assessment persistence, ResourceNode registry, path planning, path visualization, Konling runtime upgrades, privacy/audit enforcement, and teacher ResourceNode management.
- [ ] 1.4 Document source-of-record rules for TeachingResource, runtime lesson media, ResourceNode planning metadata, and duplicate asset references.
- [ ] 1.5 Define learner-state quantification dictionaries for primary competencies, second-level dimensions, knowledge mastery, resource preference, media absorption, path execution, and intervention outcomes, including value ranges, source families, algorithm versions, evidence thresholds, confidence policies, fallback reasons, and privacy scopes.

## 2. Stage 1 Learner State and Evidence Features

- [ ] 2.1 Extend the student evidence feature cache to include second-level competency state, knowledge mastery, resource preference, media absorption, and path execution features while consuming existing simulation/Arena feature groups.
- [ ] 2.2 Implement learner-state read APIs that use governed facts, snapshots, profile summaries, feature cache, adaptive assessment records, path feedback, and prerequisite-provided simulation/Arena features.
- [ ] 2.3 Implement assessment-backed BKT-compatible mastery updates and conservative non-assessment mastery confidence rules.
- [ ] 2.4 Expose confidence, evidence windows, source coverage, stale/missing/partial markers, privacy levels, and low-confidence fallback reasons in learner-state responses.
- [ ] 2.5 Add tests for cache rebuild determinism, missing/stale handling, low-confidence fallback, privacy-scoped state reads, and simulation/Arena feature consumption without redefinition.
- [ ] 2.6 Add tests or contract checks that learner-state fields cannot be exposed to path planning or Konling without a declared quantification contract and that differently scaled low-confidence signals are not treated as equivalent high-confidence state.

## 3. Stage 1 Adaptive Assessment Persistence

- [ ] 3.1 Replace memory-only assessment session and answer storage with persistent sessions, answers, question references, ability estimates, mastery updates, and algorithm versions.
- [ ] 3.2 Emit governed LearningFacts for assessment submissions and mastery updates without duplicating raw question text into learner-state payloads.
- [ ] 3.3 Keep existing assessment API response shapes compatible during the migration.
- [ ] 3.4 Add tests for persistence, restart survival, ability-update reproducibility, BKT-compatible mastery updates, privacy-safe payloads, and LearningFact materialization.

## 4. Stage 1 ResourceNode Registry and Minimum Teacher Entrance

- [ ] 4.1 Backfill ResourceNodes for TeachingResources, registered interactive components, knowledge nodes/cards, runtime lesson media, handouts, quizzes, eligible simulations, Arena tasks, reflections, AI interventions, and projects.
- [ ] 4.2 Add ResourceNode registry APIs and audits for missing renderer links, missing knowledge mappings, invalid prerequisites, privacy conflicts, unavailable resources, and path-ineligible resources.
- [ ] 4.3 Add the first teacher ResourceNode management entrance with categorized browse/search, mapping warnings, availability, privacy level, teacher policy, and path eligibility status.
- [ ] 4.4 Add scoped tests for teacher permissions, registry audits, source-of-record behavior, and path eligibility updates.

## 5. Stage 1 Rules + Graph Path Planner and Visualization

- [ ] 5.1 Implement rules plus graph search for candidate path generation using learner state, ResourceNode graph, prerequisites, time budget, teacher policy, availability, privacy, risk intervention priority, and terminal constraints.
- [ ] 5.2 Persist learning plans, plan nodes, alternatives, explanations, execution status, deviations, correction attempts, and feedback.
- [ ] 5.3 Add map, timeline, and evidence views for learning paths.
- [ ] 5.4 Add path evaluation events for path adoption, node completion, deviation, correction success, explanation clicks, and low-confidence path states.
- [ ] 5.5 Add tests for constraint enforcement, explanation consistency, fallback behavior, privacy filtering, correction paths, and visualization payload shape.

## 6. Stage 1 Konling State-Aware Runtime

- [ ] 6.1 Add server tools for `get_page_context`, `get_learner_state`, `get_plan_context`, `search_learning_memory`, `search_knowledge_graph`, `recommend_next_action`, `get_simulation_status`, `record_intervention_result`, and `analyze_attempt`.
- [ ] 6.2 Change Konling prompt/context construction to use server learner state and plan context instead of default or client-provided profile values.
- [ ] 6.3 Persist working summaries, session summaries, episodic learner memories, and intervention outcomes with privacy controls.
- [ ] 6.4 Implement corrective and remedial interventions with why-now, evidence, alternatives, cooldowns, and teacher policy checks.
- [ ] 6.5 Add tests for tool authorization, memory retrieval, intervention cooldowns, feedback persistence, prompt context composition, and redaction of raw dialogue/answer data.

## 7. Stage 1 Privacy, Compliance, and MVP Validation

- [ ] 7.1 Add shared privacy classification for learner state, assessment, path, Konling memory, teacher resource management, and evaluation payload fields.
- [ ] 7.2 Add redaction and role-scoped access rules for student, teacher, admin, and audit-only payloads.
- [ ] 7.3 Add privileged access logging for teacher/admin learner-state, path, memory, and assessment drilldowns.
- [ ] 7.4 Verify Stage 1 with `rtk npm run lint`, `rtk npm run test`, `rtk npm run build`, targeted service/API/component tests, and `rtk proxy openspec validate build-xh202620-adaptive-learning-platform --strict`.

## 8. Stage 2 Adaptive Optimization and Experimentation

- [ ] 8.1 Implement contextual bandit reranking only for local alternatives after feasible paths are generated and Stage 1 path feedback is available.
- [ ] 8.2 Add experiment assignment and reporting for current recommendation cards, rules+graph path, rules+graph+bandit, and Konling intervention variants.
- [ ] 8.3 Add analytics for path adoption rate, deviation rate, correction success, explanation clicks, intervention acceptance, 48-hour follow-through, learner-state freshness, source coverage, and low-confidence rate.
- [ ] 8.4 Extend teacher ResourceNode management to bulk mapping, policy review, coverage dashboards, and system-owned issue triage.
- [ ] 8.5 Add long-term semantic learner memory and strategy memory after privacy audit and Stage 1 intervention outcomes are stable.
- [ ] 8.6 Add tests for bandit scoping, experiment stratification, metric attribution, long-term memory privacy, and teacher bulk-management permissions.

## 9. Final Validation and Handoff

- [ ] 9.1 Produce ER/data-dictionary/API-example notes for learner state, ResourceNode, path, memory, intervention, privacy, and evaluation payloads.
- [ ] 9.2 Confirm rollback leaves existing profile, recommendation, classroom, resource, and chat routes operational behind feature flags.
- [ ] 9.3 Verify final implementation with `rtk npm run lint`, `rtk npm run test`, `rtk npm run build`, relevant integration tests, and `rtk proxy openspec validate build-xh202620-adaptive-learning-platform --strict`.
