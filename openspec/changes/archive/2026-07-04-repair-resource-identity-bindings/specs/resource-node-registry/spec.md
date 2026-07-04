## ADDED Requirements
### Requirement: Resource identities are repaired before semantic promotion
TeachingResource and runtime lesson records SHALL have stable registry identity before they can be reviewed for graph binding or path eligibility.

#### Scenario: TeachingResource identity is repaired
- **WHEN** a TeachingResource is inventoried for resource governance
- **THEN** it SHALL reference a registered registry id or declare a reviewed identity limitation
- **AND** unregistered registry ids SHALL block semantic promotion and path eligibility.

#### Scenario: Runtime artifact is missing
- **WHEN** a mapped runtime lesson artifact such as a lesson JSON is missing
- **THEN** downstream semantic review SHALL remain blocked for the affected resource family
- **AND** the helper SHALL report the exact missing artifact until it is restored or given a reviewed limitation.
