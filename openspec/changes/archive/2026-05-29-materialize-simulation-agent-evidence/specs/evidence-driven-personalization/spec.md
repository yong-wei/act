## ADDED Requirements

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
