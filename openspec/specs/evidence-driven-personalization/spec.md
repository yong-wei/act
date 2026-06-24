# evidence-driven-personalization Specification

## Purpose
Define the governed evidence contract for visible profile and recommendation personalization so recommendations remain explainable, traceable, and honest about confidence without introducing a new recommendation engine.
## Requirements
### Requirement: Personalization reads governed evidence
The system SHALL use governed evidence, snapshots, summaries, or student evidence feature cache data, including simulation/Arena-derived features, for core profile and recommendation decisions.

#### Scenario: Recommendation consumer reads governed feature data
- **WHEN** a recommendation or profile consumer needs student learning evidence
- **THEN** it SHALL read governed facts, snapshots, summaries, or evidence feature cache data for core profile computation
- **AND** raw source-table reads SHALL be limited to audit, debug, migration, or drilldown paths.

#### Scenario: Existing scope is preserved
- **WHEN** personalization consumers are upgraded to governed evidence
- **THEN** the change SHALL preserve the existing recommendation scope and competency model
- **AND** it SHALL NOT introduce a new AI recommendation engine.

#### Scenario: Simulation features contribute to weak-area rationale
- **WHEN** simulation or Arena-derived feature cache data identifies weak metrics, repeated constraint failures, low replay confidence, or incomplete evidence
- **THEN** personalization output SHALL be able to reference those governed features as rationale with source coverage and confidence metadata

### Requirement: Recommendations expose evidence rationale
The system SHALL expose reason metadata for evidence-driven profile and recommendation outputs, including whether simulation/Arena evidence came from official evaluation, course-launched simulation, standalone simulation, or preview-only activity.

#### Scenario: Recommendation includes reason metadata
- **WHEN** the system returns a recommendation or profile claim based on governed evidence
- **THEN** it SHALL include reason code, evidence window, evidence count, and source coverage metadata where relevant
- **AND** the rationale SHALL be derived from the same governed evidence used for the decision.

#### Scenario: Context-only evidence is not overstated
- **WHEN** passive views, navigation, leaderboard browsing, or other context-only activity appears in a recommendation rationale
- **THEN** the output SHALL identify it as context rather than direct competency improvement evidence
- **AND** it SHALL NOT present context-only events as the sole basis for a high-confidence competency claim.

#### Scenario: Preview-only simulation evidence is used
- **WHEN** a recommendation uses preview-only simulation or Arena evidence
- **THEN** the rationale SHALL identify it as preview-only and SHALL NOT present it as an official evaluation result

### Requirement: Low-confidence personalization is explicit
The system SHALL mark missing, stale, partial, or low-confidence evidence in profile and recommendation outputs.

#### Scenario: Missing or stale features produce fallback state
- **WHEN** governed evidence features are missing, stale, partial, or low confidence for a student
- **THEN** personalization output SHALL expose a low-confidence or fallback state
- **AND** it SHALL NOT present the output as a complete precise diagnosis.

#### Scenario: Teacher/admin explanation can inspect confidence
- **WHEN** teacher or admin-facing services expose recommendation or profile rationale
- **THEN** they SHALL include enough confidence and source coverage metadata to explain why the recommendation is strong, weak, stale, or incomplete.

### Requirement: Personalization preserves simulation-agent provenance
Profile and recommendation outputs SHALL preserve provenance, confidence, and source coverage when using simulation, Arena, or Konling agent evidence.

#### Scenario: Recommendation uses simulation evidence
- **WHEN** a recommendation references simulation-derived weakness, improvement, or constraint failures
- **THEN** it SHALL include source type, evidence window, evidence count, replay confidence, and whether the source was course-launched, standalone, Arena preview, official evaluation, or agent-assisted.

#### Scenario: Recommendation uses agent analysis
- **WHEN** a recommendation uses Konling analysis or intervention evidence
- **THEN** it SHALL identify the supporting AgentToolRun or materialized evidence summary
- **AND** it SHALL NOT present unreviewed model narrative as a high-confidence competency fact.

### Requirement: Personalization remains owner-user scoped
Profile and recommendation services SHALL use only evidence belonging to the requested user except for explicitly authorized aggregate benchmarks.

#### Scenario: Student profile is read
- **WHEN** a student profile or recommendation is generated
- **THEN** simulation records, Arena preview records, and Konling memory/evidence from other users SHALL NOT contribute to that student's personalized claims.

### Requirement: Personalization can cite governed path execution features
Profile, recommendation, and learner-state personalization SHALL be able to use governed control-correction path features as rationale without scanning raw execution payloads.

#### Scenario: Recommendation uses path evidence
- **WHEN** a recommendation references path completion, deviation, fallback, terminal validation, or intervention outcome
- **THEN** it SHALL identify the supporting governed feature group, evidence window, source count, confidence, and privacy-safe source references
- **AND** it SHALL NOT present unreviewed model-authored intervention text as a high-confidence competency fact.

#### Scenario: Path evidence is weak
- **WHEN** path evidence is missing, stale, partial, preview-only, or low-confidence
- **THEN** personalization output SHALL expose the limiting evidence state
- **AND** it SHALL NOT present the recommendation as a complete precise diagnosis.

### Requirement: Personalized explanations expose citation coverage
Personalized recommendations and profile explanations SHALL expose citation coverage when they are generated for the control-correction path.

#### Scenario: Recommendation is explained
- **WHEN** a control-correction recommendation or coaching rationale is shown to a student
- **THEN** it SHALL expose content, learner-state, path-execution, simulation, Arena, or intervention citations that support the claim
- **AND** it SHALL identify missing citation classes or low-confidence evidence as limitations.

#### Scenario: Citation support is insufficient
- **WHEN** required citations cannot be retrieved or normalized
- **THEN** personalization output SHALL return a fallback or low-confidence explanation
- **AND** it SHALL NOT present the claim as fully verified.

### Requirement: Personalization distinguishes targets from observed mastery
Profile, diagnosis, and recommendation outputs SHALL distinguish desired capability targets from observed learner evidence.

#### Scenario: Capability target is shown
- **WHEN** a personalized explanation references a target on a knowledge node
- **THEN** it SHALL identify the target capability level and the evidence state separately
- **AND** it SHALL NOT present a teacher-defined target as proof that the learner has mastered that target.

#### Scenario: Evidence is missing for target
- **WHEN** a learner has no governed evidence for a capability target
- **THEN** personalization SHALL expose missing or low-confidence evidence
- **AND** it SHALL prefer starter or evidence-gathering recommendations over high-confidence mastery claims.

### Requirement: Personalization consumes knowledge capability evidence writeback
Profile, diagnosis, path planning, and recommendation personalization SHALL consume knowledge, capability, and quality evidence only after it has been materialized from governed sources.

#### Scenario: Evidence updates graph overlay state
- **WHEN** path execution, exercise, teacher-approved grading, simulation, Arena, interactive lesson, or approved Konling tool outcome is materialized through K/A/Q evidence writeback
- **THEN** personalization MAY use it as rationale according to its target refs, confidence, authority, freshness, source coverage, privacy-safe references, and limitation metadata
- **AND** raw source payloads or unreviewed model narrative SHALL NOT bypass the writeback governance layer.

#### Scenario: Writeback is degraded
- **WHEN** evidence is missing required graph/resource/version/citation context or is preview-only
- **THEN** personalization SHALL expose the limiting evidence state
- **AND** it SHALL NOT present the recommendation, profile claim, or diagnosis as a complete precise mastery judgment.
