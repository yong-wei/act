## MODIFIED Requirements

### Requirement: Bindings use exact identity or one-to-one crosswalk
A formal BOUND record MUST use a unique Canonical ID match or an explicit one-to-one crosswalk row. Chinese labels, unit-number suffixes, fuzzy match, and vector similarity MUST NOT create BOUND. The card binding channel MUST consume the card frontmatter `canonical_id` first and the reviewed `card-crosswalk.jsonl` second; only when both are absent MAY a card enter the exception ledger as `no-exact-identity`. Unconditional ledgering of Chinese-slug cards without consulting declared identity MUST NOT occur.

#### Scenario: Canonical card id matches an overlay core
- **WHEN** a runtime Authority card id equals an overlay core canonical id
- **THEN** the restage SHALL emit an EXPLAINS binding to that core

#### Scenario: Card declares identity via frontmatter or crosswalk
- **WHEN** an `act:card:<slug>` row has a frontmatter `canonical_id` or a reviewed one-to-one `card-crosswalk.jsonl` row resolving to one overlay core
- **THEN** the restage SHALL bind the card to that core
- **AND** it SHALL NOT be ledgered as `no-exact-identity`

#### Scenario: Chinese slug has no crosswalk
- **WHEN** an `act:card:<chinese-slug>` row has no frontmatter `canonical_id` and no exact crosswalk to one Canonical ID
- **THEN** it SHALL NOT become BOUND
- **AND** it SHALL enter the exception ledger with reason `no-exact-identity`

## ADDED Requirements

### Requirement: Infographs enter the teaching projection
The runtime infographic file set MUST enter the Teaching Projection as a registered `infographic` resource subtype. Authority infographs (`infographs/authority/nodes/*.png`) whose file-name token exactly equals an overlay core Canonical ID MUST bind EXPLAINS to that core. Legacy infographs (`infographs/nodes/*.png`) MUST bind through the same declared-identity or one-to-one crosswalk channel as cards. Tokens with no core match MUST enter the exception ledger; prefix or fuzzy matching MUST NOT create bindings.

#### Scenario: Authority infograph token matches a core
- **WHEN** an authority infograph file-name token exactly equals an overlay core Canonical ID
- **THEN** the restage SHALL add the infographic resource and bind EXPLAINS to that core

#### Scenario: Infograph token matches no core
- **WHEN** an infograph token matches no overlay core after exact identity and one-to-one crosswalk checks
- **THEN** it SHALL enter the exception ledger with an explicit reason
- **AND** it SHALL NOT be bound by prefix or fuzzy matching

### Requirement: Lesson and step inventory feeds the restage
The restage pipeline MUST consume the active lesson/step inventory so that published lessons and their steps appear as Teaching Projection resource types. A restage that omits the active inventory MUST fail closed rather than publish a projection without lesson and step resources.

#### Scenario: Published lesson is inventoried
- **WHEN** the active inventory lists a published lesson and its steps
- **THEN** the restage SHALL project lesson and step resources with deterministic identities
- **AND** they SHALL bind under the same exact-identity rules as other resource types

#### Scenario: Inventory input is missing
- **WHEN** the restage runs without the active lesson/step inventory
- **THEN** it SHALL fail closed
- **AND** it SHALL NOT publish a projection that lacks lesson and step resources

### Requirement: Core nodes are fed from the prerequisite publication
The restage MUST populate projection core nodes from the prerequisite publication `core-nodes.json` whose identity matches the projection Authority release. A hard-coded empty core-node set MUST NOT be published for a non-empty course scope.

#### Scenario: Publication matches the Authority release
- **WHEN** the prerequisite publication identity matches the projection Authority release
- **THEN** the restage SHALL write its path-eligible core-node set into the projection authoring

#### Scenario: Publication identity drifts
- **WHEN** no prerequisite publication matches the projection Authority release
- **THEN** the restage SHALL fail closed
- **AND** it SHALL NOT publish an empty core-node set

### Requirement: Exception ledger is governed by per-category quotas
The exception ledger MUST be consumed by the governance report with per-reason-category counts, trends, and entry lists. The restage allow-ledger threshold MUST be configured per reason category instead of one global total, and each category quota MUST be tightened as its category closes until only explicit exemptions remain.

#### Scenario: Category quota is exceeded
- **WHEN** entries in one ledger reason category exceed its configured quota
- **THEN** the restage SHALL fail closed
- **AND** the governance report SHALL list the offending category and its entries

#### Scenario: Category quota is tightened after closure
- **WHEN** a category's remaining entry count drops after remediation
- **THEN** its quota SHALL be tightened in an independent configuration change
- **AND** previously closed entries SHALL NOT re-enter the ledger without a new explicit reason
