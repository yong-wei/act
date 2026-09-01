## ADDED Requirements

### Requirement: Domain concept labels are readable before selection
The bounded domain overview SHALL present the complete governed name of ordinary DomainConcept nodes without requiring selection or hover. Force separation, camera fit and label collision SHALL jointly satisfy an explicit default visible-label ratio on desktop; on mobile the selection-independent readable-name channel for large domains is the browsable node directory, because fitting hundreds of concepts into a phone viewport leaves nodes at pixel scale where readable canvas labels are geometrically impossible.

#### Scenario: Domain overview becomes usable
- **WHEN** the force layout reaches its accepted settlement milestone
- **THEN** the configured minimum proportion of DomainConcept labels SHALL be visible and readable on desktop
- **AND** ordinary labels SHALL not be reduced to selected-only or hovered-only presentation on either surface

#### Scenario: Mobile large-domain overview stays identifiable
- **WHEN** a bounded overview larger than the compact threshold is fitted on a mobile viewport
- **THEN** the browsable node directory SHALL remain the selection-independent readable-name channel
- **AND** a selected concept's canvas label SHALL stay visible through the viewport clamp fallback

#### Scenario: Density prevents one label
- **WHEN** one label cannot fit after force separation and camera fitting
- **THEN** the LOD policy MAY defer that label while preserving its accessible name
- **AND** the evidence SHALL record the deferred count against the accepted budget
