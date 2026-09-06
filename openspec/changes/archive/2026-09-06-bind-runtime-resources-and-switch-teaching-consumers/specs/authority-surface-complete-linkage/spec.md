## ADDED Requirements

### Requirement: Product linkage uses the runtime card and resource set
Inspector and path-planning completeness for cards, infographs, and system resources MUST be measured against the runtime file set served to learners. The git-tracked one-node v2 fixture remains a CI fail-closed sample and MUST NOT be reported as product coverage.

#### Scenario: Operator inspects teaching-scope nodes
- **WHEN** a teaching-scope overlay core is selected in the knowledge workspace
- **THEN** associated runtime cards and bound system resources SHALL list when their v2/runtime rows bind that core
- **AND** absence of a git-tracked card file SHALL NOT hide a valid runtime card

#### Scenario: Git CI runs on the fixture
- **WHEN** the linkage gate runs in git CI
- **THEN** it SHALL validate only git-tracked v2 rows and sidecar identity
- **AND** it SHALL NOT treat local untracked runtime cards as the committed inventory
