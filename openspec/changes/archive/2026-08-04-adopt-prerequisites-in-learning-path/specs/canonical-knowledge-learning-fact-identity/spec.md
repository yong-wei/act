## MODIFIED Requirements

### Requirement: New facts carry complete Canonical knowledge identity
After a Projection-bound path or resource activity is active, every new knowledge-scoped LearningFact MUST persist `canonicalId`, `authorityReleaseId`, `projectionId`, and `resourceId` alongside existing evidence/source identity. The producer MUST reject candidate, missing, or cross-scope combinations.

#### Scenario: Projection-bound fact is accepted
- **WHEN** a learner completes an eligible projected resource under the current Authority/Projection combination
- **THEN** the fact SHALL persist all four identities and the resource role/scope

#### Scenario: Resource identity is incomplete
- **WHEN** a writer lacks canonical, Authority, Projection, or resource identity
- **THEN** the write SHALL fail closed without a partial fact

### Requirement: Canonical facts obey teaching admission gates
A new Canonical fact MUST target a node admitted by the active ACT Teaching Projection and an accessible resource/path scope. ActKG visibility alone, a RECOMMENDED edge, or an unprojected node MUST NOT authorize a fact.

#### Scenario: Node is browsable but not projected
- **WHEN** a learner interacts with an engineering-only node lacking a current teaching resource
- **THEN** the formal knowledge fact write SHALL be rejected
- **AND** engineering browsing telemetry SHALL remain separate

### Requirement: Historical facts remain Legacy-bound
Historical LearningFacts MUST remain unchanged and MUST be interpreted through their stored Legacy revision/identity and an immutable old-ID-to-Canonical crosswalk at read time. This change MUST NOT perform full backfill or create a Canonical sidecar fact.

#### Scenario: Historical fact is read after cutover
- **WHEN** a reader loads a fact without Projection identity from a prior revision
- **THEN** it SHALL resolve the display Canonical/resource context through crosswalk metadata
- **AND** the original fact bytes and authority revision SHALL remain unchanged
