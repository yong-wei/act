## ADDED Requirements

### Requirement: Every active graph surface follows the selected qualified locale
Root navigation, domain concepts, secondary nodes, relation terms, formula context, search, filter controls, hover, inspector, optional-content availability and accessibility SHALL use the same selected qualified locale. Stable object, relation, resource and launch identities SHALL not change with locale.

#### Scenario: English frame is displayed
- **WHEN** the active graph commits a qualified English generation
- **THEN** no user-visible or accessible Authority/ACT interface string SHALL remain Chinese except explicitly quoted source content with declared language
- **AND** graph topology and interaction state SHALL remain unchanged

#### Scenario: Optional block lacks English
- **WHEN** an ACT-owned card or resource body does not declare English availability
- **THEN** the English inspector SHALL omit it or show the bounded English unavailable state
- **AND** it SHALL not inject the Chinese body into the English graph
