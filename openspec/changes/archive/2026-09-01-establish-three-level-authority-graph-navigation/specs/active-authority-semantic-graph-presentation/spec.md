## ADDED Requirements

### Requirement: Active Authority exposes exactly three progressive graph levels
The ordinary active workspace SHALL present three explicit levels: line-free top-level domain navigation, a selected domain's bounded DomainConcept overview, and a selected concept or search result's published one-hop semantic network. Desktop and mobile SHALL apply the same level semantics and MUST NOT flatten secondary types into the domain overview.

#### Scenario: Viewer enters a domain
- **WHEN** a viewer selects a ready root domain
- **THEN** the canvas SHALL show only that domain's bounded DomainConcept overview
- **AND** Formula, KnowledgeStatement, SystemModel and ModelRepresentation nodes SHALL remain undisclosed until search or one-hop exploration

#### Scenario: Viewer selects a domain concept
- **WHEN** the viewer activates one visible concept
- **THEN** the canvas SHALL materialize its bounded published one-hop network as the third level
- **AND** every displayed edge SHALL retain its exact source relation and endpoints

#### Scenario: Viewer returns to the domain overview
- **WHEN** the viewer leaves a selected neighborhood
- **THEN** the same domain's concept overview, filters and viewport state SHALL be restored
- **AND** undisclosed secondary nodes SHALL not remain flattened into the overview
