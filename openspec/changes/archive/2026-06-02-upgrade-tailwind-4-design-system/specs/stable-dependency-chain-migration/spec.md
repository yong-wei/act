## ADDED Requirements

### Requirement: Tailwind upgrades preserve design-system and visual behavior
The project SHALL validate platform tokens, layered CSS behavior, commercial UI governance, and representative browser rendering when upgrading Tailwind.

#### Scenario: Tailwind 4 upgrade is reviewed
- **WHEN** Tailwind and its PostCSS integration are upgraded to the selected latest stable Tailwind 4 line
- **THEN** CSS directives, PostCSS configuration, platform token behavior, commercial UI governance, build output, and browser visual checks SHALL pass or document explicit blockers
- **AND** the change SHALL record any intentional visual differences.
