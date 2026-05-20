## ADDED Requirements

### Requirement: Classic preset renders configured free-explore model
The classic four-view preset SHALL render in free-explore mode when the session has a transfer-function working model and the required time-domain, Bode, root-locus, and Nyquist views.

#### Scenario: Free explore opens classic four-view preset
- **WHEN** a student opens `/interactive-learning/control-workbench?mode=explore&preset=classic-four-view`
- **THEN** the workbench SHALL render the classic four-view preset
- **AND** the embedded analysis client SHALL receive the selected free-explore plant model
- **AND** no official Arena submission panel SHALL render.

#### Scenario: Classic preset remains fail-closed for incompatible context
- **WHEN** the session has no transfer-function working model
- **THEN** the classic preset SHALL show a Chinese incompatible-workbench message
- **AND** it SHALL NOT render transfer-function charts for hidden or missing model data.
