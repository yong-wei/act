## ADDED Requirements

### Requirement: Domain concept labels are readable before selection
The bounded domain overview SHALL present the complete governed name of ordinary DomainConcept nodes without requiring selection or hover. Force separation, camera fit and label collision SHALL jointly satisfy an explicit default visible-label ratio on desktop and mobile.

#### Scenario: Domain overview becomes usable
- **WHEN** the force layout reaches its accepted settlement milestone
- **THEN** the configured minimum proportion of DomainConcept labels SHALL be visible and readable
- **AND** ordinary labels SHALL not be reduced to selected-only or hovered-only presentation

#### Scenario: Density prevents one label
- **WHEN** one label cannot fit after force separation and camera fitting
- **THEN** the LOD policy MAY defer that label while preserving its accessible name
- **AND** the evidence SHALL record the deferred count against the accepted budget
