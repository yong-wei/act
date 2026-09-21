## ADDED Requirements

### Requirement: Active hull and wake consumers share surface time
Every active marine hull, wake and water-hugging overlay SHALL consume the shared visual time and explicit surface reference; a raw renderer-clock query SHALL NOT bypass an injected visual epoch.

#### Scenario: Visual time is changed independently of renderer time
- **WHEN** QA seeks or resets the visual clock while renderer elapsed time remains different
- **THEN** hull contact, water and overlay queries agree on the new surface time and stateful effects apply their declared history policy

### Requirement: Fleet mounting applies declared contact ownership
All active vessel mounts SHALL apply explicit contact references and motion ownership rather than relying on an implicit zero-height default.

#### Scenario: The cruise ship rolls on a moving surface
- **WHEN** the numerical model supplies roll and the scene supplies its declared water reference
- **THEN** the mount preserves the numerical roll and applies the appropriate waterline reference without an extra visual roll
