## Purpose

Define the canonical response vocabulary for manifest-driven interactive lesson
activity cards so rendering, scoring, submission evidence, and governance
classification use the same response semantics while legacy manifests are
migrated.
## Requirements
### Requirement: Response kinds are canonical
The system SHALL define a finite canonical response vocabulary for manifest activity cards.

#### Scenario: New activity uses canonical response kind
- **WHEN** a new or migrated activity card collects an answer
- **THEN** its response kind SHALL be one of `choice.single`, `choice.binary`, `choice.multi`, `text.short`, `text.long`, `text.structured`, `parameter.set`, `ordering.sequence`, `matching.pairs`, `table.builder`, `simulation.result`, or `training.result`
- **AND** historical names SHALL be accepted only through explicit alias normalization during migration.

### Requirement: Response aliases normalize predictably
The system SHALL normalize legacy response names to canonical response kinds before scoring or evidence classification.

#### Scenario: Text aliases normalize to text response
- **WHEN** a legacy activity uses `fill_text`, `text`, `short_response`, `short_text`, or `observation_text`
- **THEN** the activity SHALL normalize to a canonical text response kind
- **AND** the original alias MAY be retained only as trace metadata.

#### Scenario: Matching aliases normalize to matching response
- **WHEN** a legacy activity uses `drag_match`, `triple_match`, or `match`
- **THEN** the activity SHALL normalize to `matching.pairs`
- **AND** scoring SHALL compare item-option structure rather than answer text order.

#### Scenario: Ordering aliases normalize to ordering response
- **WHEN** a legacy activity uses `drag_sort` or `card_sort`
- **THEN** the activity SHALL normalize to `ordering.sequence`
- **AND** scoring SHALL preserve partial structure detail.
