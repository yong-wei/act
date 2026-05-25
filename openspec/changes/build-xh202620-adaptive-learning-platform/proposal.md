## Why

The platform already has governed learning evidence, feature-cache foundations, knowledge graph data, registered interactive resources, and Konling UI scaffolding, but it does not yet have the orchestration layer required by the XH-202620 adaptive-learning target. The next change should turn those assets into a coherent adaptive loop: learner state, resource graph, path planning, path visualization, and agent intervention.

This change depends on the existing virtual-simulation-platform-refactor series being implemented first. The execution gate is explicit: all seven prerequisite changes must pass strict validation, have no remaining tasks, and expose the promised protocol/resource/evidence/feature contracts before this adaptive-learning layer consumes them:

- `standardize-simulation-scene-and-trace-protocol`
- `make-simulation-runtime-replayable`
- `govern-simulation-and-arena-evidence-sources`
- `unify-arena-preview-adapter-and-model-registry`
- `register-simulations-as-course-resources`
- `split-simulation-scene-shells`
- `materialize-simulation-features-for-personalization`

## What Changes

- Add a unified Learner State Service that keeps the existing six primary competency dimensions while adding second-level state, knowledge mastery, resource preference, media absorption, path state, confidence metadata, and per-field quantification contracts.
- Persist adaptive assessment answers and ability updates into the database and governed evidence pipeline instead of using memory-only stores.
- Introduce a ResourceNode registry that maps lesson steps, knowledge nodes/cards, media, handouts, quizzes, simulations, Arena tasks, reflections, AI interventions, and projects into one path-plannable resource graph.
- Add an adaptive path planner that uses rules and graph search for the base path and contextual bandit only for local reranking; reinforcement learning and mature hybrid methods remain out of scope.
- Add path visualization views: map, timeline, and evidence explanation.
- Upgrade Konling from a client-profile chat panel to an agent runtime that reads learner state, page context, plan context, learning memory, and intervention outcomes.
- Add a teacher-facing ResourceNode management entrance for categorized access, mapping, policy, availability, and path-eligibility management.
- Add adaptive-learning evaluation, experiment assignment, and privacy/compliance governance for learner state, paths, Konling, and teacher views.
- Preserve existing recommendation cards, profile APIs, and chat routes as compatibility surfaces while the new services are introduced behind feature flags.

The implementation is phased. Stage 1 is the report's MVP: persistent adaptive assessment, unified ResourceNode registry, Learner State Service, rules+graph path planning with explanation views, and Konling reading real state for remedial/corrective interventions. Stage 2 adds contextual bandit reranking, deeper teacher management, long-term strategy memory, and A/B experimentation once Stage 1 evidence is stable.

## Capabilities

### New Capabilities
- `adaptive-learner-state-service`: Defines the canonical learner-state read model, second-level profile dimensions, mastery, preference, path state, confidence, and privacy boundaries.
- `adaptive-assessment-persistence`: Persists adaptive assessment sessions, answers, ability estimates, and learning facts.
- `resource-node-registry`: Defines the unified resource node abstraction and resource graph required by path planning.
- `adaptive-learning-path-planning`: Defines path generation, constraints, objective scoring, contextual bandit reranking, feedback capture, and map/timeline/evidence visualization.
- `konling-agent-runtime`: Defines Konling's learner-state, page, plan, memory, tool, and intervention contracts.
- `teacher-resource-node-management`: Defines the teacher resource management entrance for ResourceNode classification, mapping, policy, and path eligibility.
- `adaptive-learning-evaluation-and-experimentation`: Defines offline/online metrics, experiment assignment, path and intervention analytics, and reporting fields.
- `adaptive-learning-privacy-governance`: Defines privacy classification, audit, redaction, access logging, and sensitive-field handling across learner state, paths, Konling, and teacher surfaces.

### Modified Capabilities
- `student-evidence-feature-cache`: Extend feature payloads for second-level learner state, knowledge mastery, resource preference, media absorption, and path execution features while preserving and consuming, not redefining, simulation/Arena feature groups from `materialize-simulation-features-for-personalization`.
- `evidence-driven-personalization`: Make governed personalization outputs path-plan compatible while preserving legacy recommendation-card compatibility and the simulation/Arena provenance semantics from prerequisite feature materialization.
- `learning-evidence-source-catalog`: Add assessment, resource, media, path, and Konling event families needed by the adaptive loop.
- `teacher-evidence-governance`: Add scoped teacher visibility into resource mapping coverage, path status, path evidence, and intervention outcomes.

## Impact

- Affects `prisma/schema.prisma` for learner state, resource nodes, path plans, assessment persistence, privacy/audit records, bandit feedback, experiment assignment, and agent memory/intervention persistence.
- Affects `src/lib/data-governance/**`, `src/features/assessment/**`, `src/lib/resource-registry.tsx`, `src/features/lesson-engine/**`, `src/features/knowledge/**`, `src/app/api/ai/**`, and teacher resource management routes.
- Adds API surfaces for learner state reads, path generation, path feedback, ResourceNode management, Konling context/tools, and path visualization data.
- Depends on the seven active virtual-simulation-platform-refactor changes for simulation/Arena protocol, replay, evidence governance, model registry, course-resource registration, scene shell structure, and feature materialization.
