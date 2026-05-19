## ADDED Requirements

### Requirement: Governed evidence catalog
The system SHALL maintain a machine-readable catalog of learning evidence sources that identifies each source table or event family, its provenance policy, learning scope, evidence value level, profile eligibility, and supported materialization path.

#### Scenario: Source catalog covers known evidence families
- **WHEN** the evidence catalog is generated or inspected
- **THEN** it SHALL include entries for `InteractionLog`, `StudentStepResponse`, `SimulationLog`, `UserAnswer`, `AbilityAssessment`, `PromptAssessment`, `DesignSession`, `ArenaSubmission`, `ArenaEvaluationRun`, and `LearningFact`
- **AND** each entry SHALL state whether the source is classroom-bound, standalone, out-of-class, historical, or mixed.

#### Scenario: Seed and showcase provenance is explicit
- **WHEN** a source or row family originates from seed, showcase, demo, or test data
- **THEN** the catalog SHALL mark it as not eligible for real student profile contribution by default
- **AND** any override SHALL be explicit and auditable.

#### Scenario: Low-value events remain context only
- **WHEN** a source event is a page view, navigation event, leaderboard view, or other low-value interaction
- **THEN** the catalog SHALL classify it as activity context
- **AND** it SHALL NOT directly contribute to competency scores unless a future spec explicitly upgrades that event family.

### Requirement: Source adapters normalize evidence candidates
The system SHALL provide source adapters that convert eligible raw records into normalized evidence candidates with stable source identity and traceability.

#### Scenario: Adapter output has stable provenance
- **WHEN** a source adapter emits an evidence candidate
- **THEN** the candidate SHALL include source table, source row id or deterministic source key, source timestamp, user id, evidence kind, evidence value level, provenance classification, and raw-source references
- **AND** rerunning the adapter over the same source row SHALL produce the same source identity.

#### Scenario: Interaction events use canonical event type
- **WHEN** the interaction-log adapter reads an `InteractionLog` row
- **THEN** it SHALL resolve the canonical event type from `eventData.eventType` when present before falling back to the top-level `eventType`
- **AND** materialization decisions SHALL use the canonical event type rather than the legacy wrapper type alone.

#### Scenario: High-value source families are adapter-backed
- **WHEN** governance materialization is run for out-of-class evidence
- **THEN** adapters SHALL exist for standalone resource or knowledge events, simulation logs, adaptive answer records, prompt/design assessment records, and Arena official submission records
- **AND** unsupported source families SHALL be reported instead of silently ignored.

### Requirement: Historical materialization is dry-run first and idempotent
The system SHALL materialize eligible historical evidence through a dry-run-first workflow that reports planned changes before mutation and avoids duplicate facts or features on repeated runs.

#### Scenario: Dry-run reports coverage and exclusions
- **WHEN** historical evidence materialization is run without apply mode
- **THEN** it SHALL report source counts, eligible counts, excluded counts, exclusion reasons, planned fact or feature counts, affected users, and sample source references
- **AND** it SHALL NOT write profile facts, features, snapshots, or summaries.

#### Scenario: Apply mode is idempotent
- **WHEN** historical evidence materialization is run in apply mode more than once over the same source window
- **THEN** the second run SHALL not create duplicate profile facts or feature records
- **AND** it SHALL report existing records separately from newly created records.

#### Scenario: Raw source tables are preserved
- **WHEN** historical materialization writes governed facts or features
- **THEN** it SHALL preserve raw source rows unchanged
- **AND** every generated profile-ready record SHALL retain enough source metadata to trace back to the raw row or deterministic source key.

### Requirement: Profile-ready evidence separates facts from features
The system SHALL distinguish competency-impacting facts from activity/context features so profile generation can use high-value evidence without inflating ability scores from passive behavior.

#### Scenario: High-value evidence can become a fact
- **WHEN** an eligible source candidate represents an answer result, simulation completion, prompt/design assessment, Arena official evaluation, or other scored outcome
- **THEN** it SHALL be materializable into a profile-ready fact with outcome, score or metric summary, time window, competency contribution, and traceable source metadata.

#### Scenario: Medium-value evidence becomes feature context
- **WHEN** an eligible source candidate represents resource completion, knowledge node focus, repeated practice intent, or similar process behavior without a scored outcome
- **THEN** it SHALL be available as profile or recommendation feature context
- **AND** it SHALL not directly raise a competency score unless mapped through an explicit contribution policy.

#### Scenario: Passive activity is not competency evidence
- **WHEN** a source candidate represents only page view, resource view, or navigation
- **THEN** it SHALL be available for recency, engagement, or activity-feed context
- **AND** it SHALL NOT be counted as a competency-improving fact.

### Requirement: Evidence features support efficient profile consumption
The system SHALL provide profile and recommendation consumers with governed evidence summaries or feature caches so high-traffic APIs do not scan large raw event tables on every request.

#### Scenario: Profile reads governed summaries
- **WHEN** `/api/user/profile` builds a student profile
- **THEN** it SHALL use governed facts, snapshots, summaries, or feature caches for ability and recommendation inputs
- **AND** raw source tables SHALL be used only for bounded recent activity display or explicit drill-down.

#### Scenario: Feature freshness is visible
- **WHEN** a profile or recommendation response uses governed evidence features
- **THEN** the response or backing summary SHALL expose the evidence refresh time, source window, and evidence counts used to build the profile input.

#### Scenario: Feature rebuild is deterministic
- **WHEN** feature cache generation is rerun for the same user and source window
- **THEN** it SHALL produce deterministic summary values from the same governed evidence set
- **AND** stale summaries SHALL be replaceable without mutating raw source tables.

### Requirement: Personalized applications expose evidence rationale
The system SHALL make profile and recommendation outputs explainable by exposing reason codes and concise evidence summaries when governed evidence drives the result.

#### Scenario: Recommendation includes reason code
- **WHEN** a recommendation is generated from governed evidence
- **THEN** it SHALL include a stable reason code, recommended action target, evidence window, and evidence count
- **AND** the reason code SHALL be specific enough to distinguish weak competency, low activity, incomplete resource, repeated simulation failure, Arena constraint failure, or assessment weakness.

#### Scenario: Profile exposes evidence basis
- **WHEN** a profile dimension, risk flag, or learning suggestion is derived from governed evidence
- **THEN** the system SHALL be able to expose a concise evidence basis that names the source family and key aggregate signals
- **AND** it SHALL avoid exposing raw private payloads unless the caller is authorized for drill-down.

#### Scenario: Insufficient evidence is explicit
- **WHEN** governed evidence is too sparse or too stale to support a confident profile or recommendation
- **THEN** the system SHALL mark the result as low confidence or evidence insufficient
- **AND** it SHALL avoid presenting the result as a definitive student weakness.
