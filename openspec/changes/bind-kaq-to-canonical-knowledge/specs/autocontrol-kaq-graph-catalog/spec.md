## ADDED Requirements

### Requirement: KAQ catalog validates Canonical binding readiness
The KAQ catalog MUST validate that each knowledge role intended for post-cutover formal consumption has a reviewed binding within the current CourseCoverage and pinned Release.

#### Scenario: Binding is stale
- **WHEN** a Canonical revision or Release no longer matches the catalog binding
- **THEN** the catalog SHALL mark the role not ready and block dependent cutover gates

#### Scenario: Catalog is ready before cutover
- **WHEN** all intended roles pass Canonical readiness while Legacy remains active
- **THEN** the catalog SHALL expose readiness to migration review without changing the formal consumer selector

### Requirement: Teaching relation conflicts are auditable
The catalog SHALL record one-time review and retirement status when an ActKG Teaching Projection conflicts with an existing KAQ knowledge-to-knowledge relation.

#### Scenario: ActKG relation is accepted
- **WHEN** review accepts the released ActKG teaching relation
- **THEN** the corresponding KAQ knowledge relation SHALL be retired before the ActKG relation becomes active for planning
