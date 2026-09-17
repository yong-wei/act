## Purpose

支持已审教学知识卡按当前图谱节点和正文身份替代旧卡，保证正式资源清单与内容一致，同时阻止后续构建恢复已经退役的卡片资源。

## ADDED Requirements

### Requirement: Accepted card replacements use exact current identities
The binding builder SHALL accept only reviewed card replacement records whose Authority identity, published Canonical endpoint, authoring bytes and runtime bytes match. The release manifest SHALL bind the replacement input digest.

#### Scenario: Current batch is accepted
- **WHEN** all replacement records match the current Authority and content hashes
- **THEN** each replacement SHALL be emitted as one whole-card EXPLAINS binding to its declared Canonical node

#### Scenario: Identity or bytes drift
- **WHEN** an endpoint, release identity or content hash differs from the accepted record
- **THEN** the builder SHALL reject the replacement before writing or activating a release

### Requirement: Retired cards do not return during rebuilding
The builder SHALL omit replaced card resources and their bindings, preserve unrelated resources, and reject retirement of a resource bound to another Canonical target.

#### Scenario: Historical projection still contains an old card
- **WHEN** a subsequent build encounters a retired resource in its carry-forward projection
- **THEN** the new release SHALL still omit that resource and retain the accepted replacement

#### Scenario: Old files are deleted
- **WHEN** replacements have passed validation and entered the local runtime binding release
- **THEN** old authoring and runtime card files SHALL be deleted and excluded from legacy card materialization, while immutable historical releases and provenance remain available

### Requirement: Authored cards are consumable in appropriate generated paths
Every accepted card in the teaching batches SHALL resolve to a current published Canonical endpoint, readable runtime content, and at least one appropriate registered learning goal. Unknown historical references SHALL be recorded outside the active projection rather than silently remapped by label.

#### Scenario: Generate a path for an unmastered target
- **WHEN** a learner requests the relevant goal with sufficient time and card preference
- **THEN** the actual assembled path SHALL be able to include each batch card assigned to that goal and expose a working resource launch
- **AND** reading a card SHALL NOT itself confer mastery or fabricated assessment evidence

### Requirement: Scaled batches receive independent content review
Each scaled batch SHALL retain exact node scope, source hashes, numeric verification and an independent review disposition before runtime activation. Accepted review evidence SHALL identify the final card content hashes.

#### Scenario: Batch content is corrected after review
- **WHEN** an accepted content finding is repaired
- **THEN** the affected content and its direct consequences SHALL be verified before recording accepted final hashes
- **AND** unaffected reviewed cards SHALL retain their existing review evidence

#### Scenario: A goal contains more concepts than a single path can display
- **WHEN** the batch exceeds the existing path step budget
- **THEN** verification SHALL cover appropriate initial-learning and remediation scenarios without increasing the step budget solely to pass coverage
- **AND** verification fixtures SHALL NOT be persisted as learner facts
