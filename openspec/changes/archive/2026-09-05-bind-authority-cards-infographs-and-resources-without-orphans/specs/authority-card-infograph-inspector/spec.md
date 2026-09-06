## MODIFIED Requirements

### Requirement: Accepted Knowledge Cards and infographs load on demand
The inspector SHALL request eligible Knowledge Card content and accepted infograph metadata only after node selection. Accepted cards and infographs SHALL be presented as learning content when the v2 learning-content manifest, sealed Authority identity, and Teaching overlay identity match the selected shard envelope. Missing files, hash drift and unmapped objects SHALL fail the learning-content package rather than silently omitting coverage. Draft-blocked cards SHALL be omitted from the product panel without a placeholder that looks reviewed, but they SHALL remain counted as linked in the coverage ledger. Legacy, malformed or duplicate-entry manifests SHALL fail closed before any asset bytes are read.

#### Scenario: Node has an accepted card and infograph
- **WHEN** the selected node resolves to an authorized published card and accepted infograph
- **THEN** the inspector SHALL show the card content and provide the infograph at responsive readable dimensions
- **AND** neither asset SHALL have been included in the root or domain-default shard

#### Scenario: Card is draft-blocked
- **WHEN** the selected node's card is not eligible for publication
- **THEN** the product SHALL not display the draft as reviewed knowledge
- **AND** it SHALL omit the Knowledge Card panel without exposing the raw review state

#### Scenario: Infograph fails to load
- **WHEN** an otherwise eligible infograph cannot be retrieved
- **THEN** the card and semantic node detail SHALL remain usable
- **AND** the infograph panel SHALL be omitted without exposing a path, object key or hash

#### Scenario: Teaching overlay identity matches the shard
- **WHEN** the current Authority shard envelope reports a passed teaching overlay
- **THEN** the resolver SHALL read the v2 manifest sealed to that Authority identity and overlay
- **AND** it SHALL keep semantic detail usable while omitting only assets that are genuinely missing or blocked

#### Scenario: Teaching binding is unavailable
- **WHEN** the current Authority shard envelope does not report a passed teaching overlay
- **THEN** the inspector SHALL not read independently current projection or card inputs
- **AND** it SHALL keep semantic detail usable while omitting card and infograph panels

#### Scenario: Learning export belongs to another Authority identity
- **WHEN** the learning-content manifest was exported for another Authority snapshot or release
- **THEN** the resolver SHALL fail closed for optional card and infograph content before reading their files
- **AND** the selected node's semantic detail SHALL remain usable
