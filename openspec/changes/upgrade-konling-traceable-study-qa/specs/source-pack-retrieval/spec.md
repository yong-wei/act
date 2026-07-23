## ADDED Requirements

### Requirement: Source Pack exposes evidence suitable for answer-unit binding

The `konling-answer` Source Pack profile SHALL expose only server-owned citation identifiers and bounded source limitation metadata required to bind material answer units to eligible citations.

#### Scenario: Citation evidence is unavailable or restricted

- **WHEN** a Source Pack item lacks an eligible target or is restricted, stale, or unsafe
- **THEN** the item SHALL expose its limitation state
- **AND** it SHALL NOT be used to create a verified answer-unit binding.

### Requirement: Source Pack distinguishes authority eligibility for normative guidance

The `konling-answer` Source Pack profile SHALL preserve whether a citation is eligible to support verified normative guidance without allowing model-authored source claims to alter that status.

#### Scenario: Citation cannot support normative guidance

- **WHEN** a selected citation lacks server verification, authority eligibility, or a usable target
- **THEN** the metadata SHALL mark it ineligible for verified normative guidance
- **AND** downstream consumers SHALL be able to present a verification-required state.
