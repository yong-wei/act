## ADDED Requirements

### Requirement: Node types are independently reversible without hierarchy collapse
Every registered node type already materialized in the current third-level network SHALL have an independent reversible filter. Toggling a secondary type SHALL NOT promote that type into the domain overview or require all objects of that type to be loaded.

#### Scenario: Formula visibility is toggled
- **WHEN** a one-hop network contains Formula nodes and the viewer hides Formula
- **THEN** those nodes and incident visible edges SHALL be hidden while the concept overview and other types remain
- **AND** re-enabling Formula SHALL restore the same materialized identities and state
