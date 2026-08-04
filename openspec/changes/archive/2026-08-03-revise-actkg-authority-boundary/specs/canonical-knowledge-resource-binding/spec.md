## MODIFIED Requirements

### Requirement: Final cutover requires complete active-resource bindings
Resource binding completeness SHALL be evaluated per ACT consumer package and its current published/used resources, not against every member of the ActKG Release. An unresolved resource SHALL block only the consumer package that can reach it; it SHALL not block Engineering Authority or unrelated consumers.

#### Scenario: Only inactive inventory remains unbound
- **WHEN** all unbound items for one consumer package are drafts, disabled, archived, or non-teaching assets
- **THEN** that package's resource binding gate SHALL pass even when unrelated ActKG objects are unprojected

#### Scenario: Effective resource is unresolved
- **WHEN** one effective ACT resource has no active binding and is not explicitly optional
- **THEN** the exact package SHALL fail closed
- **AND** other consumers and Engineering Authority SHALL remain independently selectable

#### Scenario: Effective resource package is complete
- **WHEN** every currently published or path/evidence-eligible resource in one consumer package has an active reviewed Canonical binding or explicit `NONE`
- **THEN** that package MAY pass its binding gate even when unrelated ActKG objects are unprojected

### Requirement: Canonical resource bindings remain shadow before cutover
Before a consumer's own Teaching Projection and activation gate pass, that consumer SHALL stay on Legacy or an explicit pinned prior combination. Completion of the global CourseCoverage list MUST NOT be required to stage an unrelated resource package.

#### Scenario: Binding migration completes before cutover
- **WHEN** an effective resource has a current `SHADOW_PUBLISHED` binding but the consumer package has not passed its own Teaching Projection and readiness gates
- **THEN** formal RAG, recommendation, path and evidence consumers SHALL continue using Legacy or an explicit pin while candidate results remain shadow diagnostics

#### Scenario: Final selector activates
- **WHEN** the later activation transaction satisfies that package's Teaching Projection and resource binding gates
- **THEN** formal resource consumers for that package SHALL resolve only the reviewed Canonical bindings selected by that package cutover

#### Scenario: Engineering-only consumer is ready
- **WHEN** Engineering Authority is valid and an Engineering RAG consumer has no ACT resource dependency
- **THEN** it MAY activate without canonical resource bindings
- **AND** Teaching Resource RAG SHALL remain on its own pinned state
