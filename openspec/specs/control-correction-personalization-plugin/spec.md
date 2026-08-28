# control-correction-personalization-plugin Specification

## Purpose
Define the versioned Personalization goal plugin that owns control-correction course, lesson, Arena, dimension and evidence-policy mappings, so generic learner-state, path and recommendation code resolve a registered plugin instead of hardcoded course identifiers.

## Requirements
### Requirement: Control-correction course policy is owned by one registered plugin

Personalization SHALL resolve `control-correction` through one versioned plugin registry. The plugin SHALL own its course, lesson, Arena task, goal-dimension, evidence-source and policy mappings; generic learner-state, path and recommendation code MUST NOT contain those concrete identifiers.

#### Scenario: A control-correction context is resolved

- **WHEN** an authorized application receives a course, lesson or Arena task context
- **THEN** the registry SHALL resolve it to one canonical goal context and plugin version
- **AND** conflicting, unknown or stale mappings SHALL return an explicit unsupported/limited result.

#### Scenario: Generic Personalization handles another goal

- **WHEN** a goal other than control-correction is requested
- **THEN** generic Personalization SHALL use the registered plugin for that goal
- **AND** it SHALL not inspect or fall back to control-correction IDs, dimensions or source lists.

### Requirement: Plugins consume and persist governed evidence through ports

The control-correction plugin SHALL read LearningFact, Assessment outcomes, path evidence, simulation and Arena summaries through declared read ports and SHALL request writes through owned application ports. Plugin writes MUST carry plugin/version identity, subject scope, source coverage, confidence, privacy class, evidence refs and idempotency identity; direct Prisma or raw payload writes are forbidden.

#### Scenario: Plugin projects a learner dimension

- **WHEN** the plugin maps governed evidence to a control-correction dimension
- **THEN** it SHALL preserve evidence lineage, freshness, confidence and privacy metadata
- **AND** missing, stale, partial or preview-only evidence SHALL remain explicit.

#### Scenario: Plugin persistence is retried

- **WHEN** the same plugin persistence decision is retried with the same subject, evidence revision and idempotency key
- **THEN** the application SHALL return the original result
- **AND** it SHALL not duplicate LearningFacts, mastery updates, path events or intervention records.

### Requirement: Plugin context cannot grant authority by itself

A course/lesson/Arena mapping or plugin-produced narrative SHALL not by itself grant mastery, readiness, terminal validation, official Arena success or teacher-scoped access. Those authorities SHALL remain with Assessment, Learning Record, Arena and existing path governance contracts.

#### Scenario: Course mapping exists without assessed evidence

- **WHEN** a learner is mapped to control-correction but has no eligible independent assessment or governed evidence
- **THEN** the plugin SHALL return a starter/limited state
- **AND** it SHALL not emit a high-confidence mastery or hard path qualification.

#### Scenario: Plugin produces an explanation

- **WHEN** a plugin returns a recommendation or coaching rationale
- **THEN** it SHALL cite privacy-safe governed source refs and confidence
- **AND** unreviewed model narrative or raw Arena/simulation payload SHALL remain restricted.

### Requirement: Missing or retired plugins fail closed without a parallel registry

The registry SHALL treat missing, disabled, conflicting or retired plugin identities as explicit unsupported/limited states. It MUST NOT use hardcoded defaults, a second goal registry, raw table scans or a forwarding facade to preserve the old course-specific path.

#### Scenario: Plugin version is unavailable

- **WHEN** a request references a plugin version that is not registered or no longer valid
- **THEN** the public API SHALL return an actionable limitation
- **AND** it SHALL not silently substitute another plugin or rewrite historical projections.

#### Scenario: Registry migration completes

- **WHEN** all callers use the single Personalization plugin registry
- **THEN** old control-correction constants, duplicate registry authority and re-export path SHALL be deleted
- **AND** architecture evidence SHALL prove no generic production module contains the retired mappings.

