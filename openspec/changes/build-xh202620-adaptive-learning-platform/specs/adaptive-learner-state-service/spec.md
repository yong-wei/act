## ADDED Requirements

### Requirement: Learner state is the canonical adaptive-learning read model
The system SHALL provide a server-owned Learner State Service that returns the current adaptive-learning state for a student from governed evidence, feature-cache payloads, assessment records, path state, and authorized aggregates.

#### Scenario: Student state is read for path planning
- **WHEN** the path planner requests learner state for a student
- **THEN** the service SHALL return primary competency state, second-level competency state, knowledge mastery, resource preference, media absorption, current risks, path context, evidence windows, and confidence markers
- **AND** the response SHALL identify missing, stale, partial, or low-confidence evidence explicitly.

#### Scenario: Client profile hints do not override server state
- **WHEN** a client sends profile-like values to an AI or path endpoint
- **THEN** the server SHALL treat those values as hints only
- **AND** authoritative learner state SHALL come from the Learner State Service.

### Requirement: Learner state retains the six primary competencies
The system SHALL retain the current six primary competency dimensions while adding second-level state dimensions required by adaptive path planning.

#### Scenario: Primary and secondary dimensions are returned together
- **WHEN** learner state is returned
- **THEN** it SHALL include `controlModeling`, `parameterDesign`, `crossDomainTransfer`, `engineeringDecision`, `inquiryReflection`, and `selfDirectedLearning`
- **AND** it SHALL include second-level dimensions for concept mastery, time/frequency transfer, modeling reliability, tuning efficiency, constrained optimization, solution stability, cross-modal transfer, scenario generalization, risk recognition, constraint compliance, explanation quality, AI-use strategy, reflection depth, path execution, persistence, and remedial initiative where evidence is available.

### Requirement: Knowledge mastery and resource preference are first-class state
The system SHALL expose knowledge-node mastery and resource/media preference states separately from broad competency scores.

#### Scenario: Mastery state supports knowledge gaps
- **WHEN** a student has assessment, classroom, simulation, Arena, or resource evidence mapped to knowledge nodes
- **THEN** learner state SHALL expose per-node mastery estimates with confidence and evidence provenance
- **AND** low-value browsing evidence SHALL NOT by itself create a high-confidence mastery estimate.

#### Scenario: Assessment-backed mastery uses versioned posterior state
- **WHEN** adaptive assessment answers update knowledge-node mastery
- **THEN** learner state SHALL use a versioned BKT-compatible posterior or equivalent assessment-backed mastery state
- **AND** non-assessment evidence SHALL contribute only through governed lower-confidence signals unless calibrated validation permits a higher confidence level.

#### Scenario: Resource preference supports personalization
- **WHEN** a student has resource completion, replay, media progress, or path feedback evidence
- **THEN** learner state SHALL expose resource type preference and media absorption summaries
- **AND** those summaries SHALL separate preference from demonstrated learning gain.

### Requirement: Learner-state fields declare quantification contracts
The system SHALL define explicit quantification contracts for learner-state fields before those fields are used by path planning, personalization, Konling, or teacher insight.

#### Scenario: Quantified field is declared
- **WHEN** a primary competency, second-level dimension, knowledge-mastery field, resource-preference field, media-absorption field, path-execution field, or intervention-outcome field is added to learner state
- **THEN** its contract SHALL declare value range, unit or scale, source evidence families, algorithm version, evidence threshold, confidence policy, stale/missing fallback behavior, fallback reason codes, and privacy scope
- **AND** downstream consumers SHALL be able to inspect the field contract or contract version used to compute the returned value.

#### Scenario: Evidence is insufficient for a quantified field
- **WHEN** a learner-state field lacks the declared minimum evidence threshold or has stale, partial, conflicting, or low-confidence source evidence
- **THEN** the field SHALL expose an explicit missing, stale, partial, or low-confidence state rather than a normalized high-confidence score
- **AND** the response SHALL identify the source-family gap or fallback reason that limits path planning or Konling use.

#### Scenario: Non-comparable signals are combined
- **WHEN** learner state combines assessment, classroom, simulation, Arena, resource, media, graph-browsing, or Konling-derived evidence
- **THEN** the computation SHALL preserve source family, scale, confidence, and algorithm version metadata
- **AND** passive/context-only evidence SHALL NOT be treated as equivalent to assessment-backed or outcome-backed evidence without a calibrated contract update.

### Requirement: Learner state enforces privacy scopes
The system SHALL return learner-state fields according to the requester role and scope.

#### Scenario: Teacher reads a student in their class
- **WHEN** a teacher requests learner state for a student they teach
- **THEN** the response SHALL include scoped diagnostic summaries and evidence confidence
- **AND** it SHALL NOT include private dialogue text, hidden Arena evaluation internals, or raw student answer bodies unless a separate authorized drilldown permits it.
