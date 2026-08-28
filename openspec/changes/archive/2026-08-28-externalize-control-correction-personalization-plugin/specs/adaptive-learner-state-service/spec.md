## ADDED Requirements

### Requirement: Control-correction learner-state slice is supplied by a plugin

The canonical control-correction learner-state slice SHALL resolve dimensions, course context, evidence sources, privacy and confidence rules from the registered Personalization plugin. `adaptive-learner-state-service` MUST NOT be the owner of concrete course, lesson or Arena task identifiers.

#### Scenario: Registered control-correction slice is read

- **WHEN** an authorized consumer requests `goal=control-correction`
- **THEN** the learner-state public API SHALL use the plugin's versioned contract
- **AND** it SHALL preserve the existing slice dimensions and role-scoped metadata.

#### Scenario: Control-correction plugin is missing

- **WHEN** the plugin cannot resolve the requested context or evidence policy
- **THEN** learner state SHALL expose unsupported/limited state
- **AND** it SHALL not use the old service constants or a generic default slice.
