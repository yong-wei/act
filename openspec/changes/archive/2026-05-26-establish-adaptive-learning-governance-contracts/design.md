## Context

The large `build-xh202620-adaptive-learning-platform` proposal contains valid ideas but mixes shared policy with multiple executable subsystems. This change extracts the shared contract so later changes can remain small and still agree on prerequisites, privacy, evaluation, compatibility, and handoff artifacts.

## Decisions

### Use an explicit prerequisite gate

Later changes that consume simulation or Arena data must stop until the seven upstream virtual-simulation changes have no remaining tasks, pass strict validation, and expose their promised protocol, replay, evidence, resource, shell, and feature contracts.

The gate is intentionally concrete. Downstream changes must check these archived changes before consuming simulation or Arena evidence:

- `standardize-simulation-scene-and-trace-protocol`
- `make-simulation-runtime-replayable`
- `register-simulations-as-course-resources`
- `unify-arena-preview-adapter-and-model-registry`
- `split-simulation-scene-shells`
- `govern-simulation-and-arena-evidence-sources`
- `materialize-simulation-features-for-personalization`

### Treat privacy and evaluation as common contracts

Every adaptive-learning payload must declare role scope and privacy level before implementation. Every path, learner-state, assessment, and Konling event that supports evaluation must share a stable event envelope so Stage 2 experiments do not reinterpret Stage 1 telemetry.

The privacy model is a five-level classification:

- `student-visible`: own progress, explanations, public resource metadata, confidence markers.
- `teacher-scoped`: class/resource-scoped evidence, risk flags, path constraints, intervention summaries.
- `admin-scoped`: platform operations, data quality, feature flag, and model-health data.
- `audit-only`: traceability records, privileged diagnostics, raw scoring diagnostics.
- `system-internal`: prompt internals, raw answers, private memory payloads, hidden Arena evaluator details, and raw traces.

The evaluation envelope keeps subsystem events comparable without forcing every subsystem into one table. Required fields are `eventType`, `actor`, `subject`, `sourceCapability`, `payloadVersion`, `occurredAt`, `privacyLevel`, `confidence`, and `relatedRefs`. Sensitive source payloads stay behind references or redacted summaries.

### Preserve current surfaces behind feature flags

Existing profile, recommendation, classroom, resource, and chat routes remain compatibility surfaces. Later changes introduce new services behind flags and must document rollback behavior.

Feature flags are part of the review contract, not a late implementation detail. Downstream changes must declare the flag name, default state, fallback surface, migration and rollback behavior, and validation command. The expected flag families are assessment persistence, learner-state service, ResourceNode registry, Stage 1 path planning, Konling adaptive runtime, teacher ResourceNode management, and Stage 2 optimization experiments.

### Require handoff artifacts

Each downstream implementation that adds a data model, API, or evaluation event must include enough contract material for the next change to consume it without reverse-engineering code. The minimum handoff is an ER or ownership boundary note, data dictionary, privacy class per field family, source-of-truth statement, retention or rollback note, and at least one request/response or event example when an API or event is involved.

## Risks / Trade-offs

- This change has little visible product value by itself, but it prevents later changes from inventing incompatible payload shapes.
- Over-specifying every field here would block useful iteration, so field-level contracts stay in the owning subsystem changes.

## Migration Plan

1. Add this contract as the first XH-202620 child change.
2. Make later child issues depend on it.
3. Use its privacy, evaluation, and rollback requirements as review gates.

## Open Questions

- None.
