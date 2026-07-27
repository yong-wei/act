## ADDED Requirements

### Requirement: Konling task proposals update the shared preparation task
Smart-preparation natural-language proposals SHALL apply through the same authorized structured task revision used by the accordion controls.

#### Scenario: Proposal is applied
- **WHEN** an authorized teacher applies a valid in-message proposal
- **THEN** the shared task revision SHALL persist the change and lineage to the conversation turn and tool run
- **AND** both the conversation and accordion SHALL reflect the same resulting task.

#### Scenario: In-message actions are available
- **WHEN** the conversation renderer supports structured proposal cards
- **THEN** the separate `查看控灵建议` surface SHALL be removed
- **AND** no second suggestion store SHALL be required.

### Requirement: Smart-preparation assistant labels are correct and localized
All smart-preparation assistant entry points SHALL display `控灵` and Chinese user-facing action labels.

#### Scenario: Smart-preparation task renders
- **WHEN** the page shows assistant collaboration or revision actions
- **THEN** it SHALL use `控灵` rather than `孔灵`
- **AND** provider, tool, draft, and task state identifiers SHALL not be exposed as untranslated primary labels.
