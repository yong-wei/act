## ADDED Requirements

### Requirement: Existing marine layouts meet actual scene quality checks
Existing layout consumers SHALL provide recognizable scale-correct geometry, contact and measured LOD or batching behavior on the declared host.

#### Scenario: Harbor and arctic scenes are replayed
- **WHEN** The camera moves through the named layouts
- **THEN** World anchoring and task semantics are preserved and declared detail transitions reduce real rendering work.
