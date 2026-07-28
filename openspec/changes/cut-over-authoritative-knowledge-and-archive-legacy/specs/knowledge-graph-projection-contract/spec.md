## ADDED Requirements

### Requirement: Legacy graph business projection retires after cutover
After successful authoritative cutover, the active graph projection contract MUST be ActKG V2 and the Legacy business projection MUST no longer serve formal runtime consumers.

#### Scenario: Cutover completes
- **WHEN** all cutover gates pass and service reopens
- **THEN** active graph requests SHALL resolve to the ActKG projection and the Legacy DTO SHALL be unavailable as a business API

#### Scenario: Historical graph is requested
- **WHEN** an authorized historical link targets Legacy content
- **THEN** the system SHALL use the independent read-only archive contract rather than the retired business projection
