## Context

The current platform is a Next.js modular monolith using Prisma and PostgreSQL. Its strongest adaptive-learning asset is the governed evidence chain from interaction events to `LearningFact`, competency snapshots, profile summaries, feature cache, and recommendation rationale. Its weakest areas are still structural: adaptive assessment is memory-only, `LearningPath` is a simple JSON node list, resource registration is component-oriented rather than path-oriented, and Konling receives default/client-provided learner profile data instead of a server-owned learner state.

This design follows the report's conservative route: keep the modular monolith, PostgreSQL, Prisma, Redis/BullMQ where already appropriate, Postgres edge tables for graph data, and pgvector-ready storage for future memory retrieval. It explicitly requires the existing simulation/Arena OpenSpec changes to become available foundations before this change consumes their contracts.

The prerequisite gate is part of the design, not just GitHub metadata. Execution must stop until these seven changes have no remaining tasks, pass strict validation, and expose their intended artifacts: `standardize-simulation-scene-and-trace-protocol`, `make-simulation-runtime-replayable`, `govern-simulation-and-arena-evidence-sources`, `unify-arena-preview-adapter-and-model-registry`, `register-simulations-as-course-resources`, `split-simulation-scene-shells`, and `materialize-simulation-features-for-personalization`.

## Goals / Non-Goals

**Goals:**

- Make learner state a server-owned, governed read model rather than a collection of page-level summaries.
- Convert all eligible platform resources into ResourceNodes that can be filtered, planned, explained, and managed.
- Generate explainable learning paths using rules plus graph search, with contextual bandit reranking for local alternatives only.
- Provide path visualization through map, timeline, and evidence views.
- Upgrade Konling to read learner state, page context, plan context, and memory, and to record intervention outcomes.
- Give teachers a unified ResourceNode management entrance for classification, mapping, policy, and path eligibility.
- Add privacy/compliance controls and evaluation/experiment instrumentation that make the XH-202620 outcomes measurable.

**Non-Goals:**

- Do not introduce reinforcement learning as a production planner in this change.
- Do not split the system into microservices.
- Do not replace the existing profile, recommendation, classroom, or chat endpoints in one breaking cutover.
- Do not rescan raw high-frequency simulation traces in normal learner-state or path APIs.
- Do not expose private student dialogue, raw answers, or hidden Arena evaluation internals through teacher management views.
- Do not implement production reinforcement learning, hybrid long-horizon planners, Milvus/Weaviate, Neo4j, Redpanda, ClickHouse, Feast, or a separate Agent Gateway in this change.

## Decisions

### Keep a modular monolith and add bounded services

The change should add server-side modules such as `learner-state`, `resource-node-registry`, `path-planner`, and `agent-runtime` inside the existing application. This avoids a premature microservice split while still creating explicit service boundaries.

Alternative considered: independent learner-state, planner, and agent services. That is unnecessary before the platform has stable contracts, enough event volume, and operational capacity for service ownership.

### Treat `LearningFact` and feature cache as the learner-state input boundary

Learner state should read governed facts, snapshots, summaries, feature-cache payloads, assessment records, resource-node execution state, and path feedback. Raw source tables remain valid for audit and drilldown, not for normal state reads.

Alternative considered: rebuild learner state directly from all raw tables on each request. That would be slower, harder to explain, and inconsistent with the existing evidence governance design.

Simulation/Arena evidence is consumed only through the feature groups and rationale fields produced by `materialize-simulation-features-for-personalization`. This change must not redefine trace summaries, replay confidence, official/preview provenance, or teacher simulation coverage.

For capabilities that this change modifies after `materialize-simulation-features-for-personalization`, the target merged spec must preserve the prerequisite scenarios for compact simulation/Arena feature derivation, raw-trace exclusion from normal consumers, preview-only versus official provenance, replay confidence, weak metric rationale, and teacher drilldown scoping. This adaptive-learning change may add learner-state, path, Konling, ResourceNode, and evaluation consumers on top of those semantics, but it must not flatten or replace them.

### Add ResourceNode as a planning abstraction above TeachingResource

`TeachingResource` and the existing component registry remain rendering and lesson-engine structures. `ResourceNode` is the path-planning abstraction: it points to a teaching resource, knowledge node, media object, assessment, simulation scene, Arena task, AI intervention, or project and carries planning metadata such as prerequisites, knowledge coverage, ability impact, cognitive load, availability, teacher policy, and privacy level.

Alternative considered: expanding `TeachingResource` until it covers every planning field. That would mix lesson rendering, resource catalog, path planning, and teacher governance concerns in one table.

Resource metadata ownership is source-of-record based:

- `TeachingResource` owns managed DB resource metadata once a resource exists there.
- Runtime lesson media indexes remain the source for authored video/audio/handout assets until they are promoted or backfilled into ResourceNodes.
- ResourceNode stores normalized planning metadata plus `sourceKind` and `sourceRef`; it does not copy raw media bodies or become the canonical content store.
- When a runtime media item and a `TeachingResource` row refer to the same asset, `TeachingResource` owns teacher-editable metadata and the runtime file remains the content/media source reference.

This removes the prior ambiguity around video/audio/handout ownership.

### Use BKT-compatible mastery for assessment-backed knowledge state

Initial knowledge mastery should use a versioned BKT-compatible posterior for assessment-backed knowledge tags and a conservative governed weighted score only for non-assessment evidence. Passive resource and graph browsing can raise context confidence, but cannot directly create high-confidence mastery.

Alternative considered: a simple weighted score for all evidence. That is easier to implement but conflicts with the report's requirement for item/knowledge-state updates. The BKT-compatible model gives the first implementation a defensible path while still allowing later item-parameter calibration.

Learner-state dimensions must be backed by explicit quantification contracts rather than only display names. Each primary, second-level, knowledge-mastery, resource-preference, media-absorption, path-execution, and intervention-outcome field should declare its value range, unit or scale, source evidence families, algorithm version, evidence threshold, confidence policy, stale/missing fallback behavior, and privacy scope. This prevents the path planner and Konling from treating weak or differently scaled signals as comparable high-confidence states.

### Use rules and graph search as the planner core

The planner should infer deficits from learner state, filter ResourceNodes, enforce prerequisites/time/teacher/availability/privacy constraints, and produce a candidate DAG. The objective follows the report's multi-objective form: learning gain, engagement, constraint satisfaction, diversity, fatigue, and dropout risk.

Contextual bandit is used only after feasible paths exist, to rerank local alternatives with observed feedback. Reinforcement learning and hybrid long-horizon policies are deferred until path data and evaluation are mature.

The implementation is phased:

- Stage 0: prerequisite verification and contract audit.
- Stage 1 MVP: assessment persistence, ResourceNode registry, Learner State Service, rules+graph path planning, path map/timeline/evidence views, and Konling state/plan/context reading with corrective and remedial interventions.
- Stage 2: contextual bandit reranking, broader teacher management workflows, long-term strategy memory, and experiment assignment/reporting.

Stage 2 work must not begin until Stage 1 produces stable evidence, path feedback, and privacy-audited learner-state reads.

### Make path visualization part of the contract

The planner is not complete unless students and teachers can inspect why a path exists. The API should support map, timeline, and evidence views with node status, alternatives, confidence, source windows, and reason codes.

### Make Konling a tool-using runtime, not a profile-passing chat client

Konling should call server tools for page context, learner state, plan context, memory search, knowledge graph search, next-action recommendation, simulation status, attempt analysis, and intervention result recording. Client-provided profile values can remain hints, but the authoritative learner state must come from the server.

### Make evaluation and privacy first-class contracts

XH-202620 cannot be evaluated through feature existence alone. Path adoption, correction success, explanation clicks, intervention acceptance, 48-hour follow-through, learner-state freshness, source coverage, low-confidence rate, and privacy audit completeness must be captured as contract-level outcomes.

Privacy is also a shared boundary, not a note inside individual specs. Learner state, path explanations, Konling memory, teacher ResourceNode management, and evaluation exports must classify sensitive fields, redact raw dialogue/answers by default, log privileged access, and separate student-facing, teacher-facing, admin-facing, and audit-only payloads.

## Risks / Trade-offs

- Broad scope can become an unreviewable implementation batch -> enforce Stage 0/Stage 1/Stage 2 gates, feature flags, compatibility endpoints, and strict validation before advancing stages.
- Multiple active changes modify the same evidence and personalization capabilities -> audit the target merged specs after prerequisite changes and preserve their simulation/Arena scenarios before adding adaptive-learning consumers.
- ResourceNode coverage can drift from actual renderable resources -> add registry audits and teacher management validation.
- Path planning can look precise while evidence is weak -> expose confidence, source coverage, and fallback states in every path explanation.
- Contextual bandit can be overused as a planner -> restrict it to local reranking and require deterministic rule/graph output before bandit scoring.
- Konling can over-intervene -> require cooldowns, teacher policy, three-part intervention explanations, and persisted outcome feedback.
- Privacy can regress as new views reuse learner state -> require field classification, redaction, access logging, and role-scoped tests before exposing any new surface.

## Migration Plan

1. Verify prerequisite changes and generated contracts before touching implementation code.
2. Add data models and read services in parallel with current profile, recommendation, resource, and chat routes.
3. Backfill ResourceNodes from existing registry entries, TeachingResources, knowledge nodes, runtime lesson media, simulations, and Arena tasks.
4. Persist adaptive assessment records and emit governed facts while keeping the existing API response shape.
5. Introduce path planner APIs behind a feature flag and display path visualizations in the learning center before replacing recommendation cards.
6. Switch Konling context loading to server learner-state and plan-context tools, then add persistent memory and intervention outcomes.
7. Add teacher ResourceNode management and governance views with scoped permissions.
8. Add evaluation/experiment instrumentation only after Stage 1 path and intervention events are stable.
9. Roll back by disabling the feature flags and leaving existing profile, recommendation, classroom, and chat paths active.

## Open Questions

- Should pgvector be enabled in the first implementation or only after the Postgres memory schema is stable?
