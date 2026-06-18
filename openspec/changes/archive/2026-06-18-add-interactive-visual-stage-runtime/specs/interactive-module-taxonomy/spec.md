## ADDED Requirements

### Requirement: Visual stage is a canonical visual module
The interactive module taxonomy SHALL support `visual.stage` as a canonical visual module for non-stacked course visuals.

#### Scenario: Visual stage is authored
- **WHEN** a runtime manifest declares `kind: visual.stage`
- **THEN** the module registry SHALL validate `stageId`, aspect ratio, layers, normalized regions, z-index, and reveal state metadata
- **AND** the renderer SHALL be provided by shared manifest runtime rather than a lesson-private component.

#### Scenario: Stage layer is invalid
- **WHEN** a `visual.stage` layer has a missing id, duplicate id, invalid region, unsupported layer kind, or invalid reveal state reference
- **THEN** manifest validation SHALL fail before merge
- **AND** the error SHALL identify the stage id and layer id when available.

### Requirement: Visual stage is not a vertical card list
The visual stage renderer SHALL provide a two-dimensional stage layout rather than rendering layers as ordinary stacked modules.

#### Scenario: Stage renders in a course page
- **WHEN** a student or teacher opens a page containing `visual.stage`
- **THEN** layer positioning SHALL be computed from stage coordinates and z-index
- **AND** the resulting DOM and browser screenshot SHALL NOT show the stage as a `space-y` vertical list of cards.
