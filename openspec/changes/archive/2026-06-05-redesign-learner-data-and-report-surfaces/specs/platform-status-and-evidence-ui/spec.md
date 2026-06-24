## ADDED Requirements

### Requirement: Loading, empty, degraded, and unavailable states inherit route archetype
Platform status UI SHALL render loading, empty, degraded, feature-flagged, low-confidence, and missing-evidence states within the current route archetype and theme template.

#### Scenario: Status state appears during redesign
- **WHEN** a learner, entry, workspace, knowledge, teacher, admin, or report surface enters loading, empty, degraded, unavailable, or low-confidence state
- **THEN** the state SHALL use the route's approved visual template, status vocabulary, and next-action guidance
- **AND** it SHALL NOT fall back to disconnected spinner pages, placeholder cards, or old dark loading screens.
