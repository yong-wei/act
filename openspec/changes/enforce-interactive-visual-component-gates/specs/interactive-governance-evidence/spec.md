## ADDED Requirements

### Requirement: Visual component evidence samples are mandatory
Interactive visual components that collect or imply student interaction SHALL provide backend evidence samples before acceptance.

#### Scenario: Evidence-producing visual component is reviewed
- **WHEN** a visual component supports selection, construction, reveal browsing, hotspot selection, embedded activity answer, parameter exploration, or graph diagnosis
- **THEN** the acceptance artifact SHALL include a backend evidence sample with lesson id, step id, module id, component id, role, action, payload, and timestamp
- **AND** the sample SHALL be sufficient for teacher diagnostics to read the interaction.

#### Scenario: Teacher diagnostics are missing
- **WHEN** a visual component records student interaction but has no teacher-readable diagnostic summary
- **THEN** acceptance SHALL fail
- **AND** the implementation SHALL add diagnostics before completion.
