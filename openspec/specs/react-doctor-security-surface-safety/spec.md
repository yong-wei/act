## Purpose

Define security constraints for React Doctor owned-surface inline markup and iframe diagnostics.
## Requirements
### Requirement: React Doctor Security category is clean for owned surfaces
The system SHALL maintain zero React Doctor Security category diagnostics on owned product surfaces.

#### Scenario: Developer validates Security category cleanup
- **WHEN** a developer runs the owned-surface React Doctor Security category gate
- **THEN** the report SHALL contain zero diagnostics
- **AND** any intentionally allowed inline markup pattern SHALL be documented and guarded by a local test

### Requirement: Iframes use explicit sandbox policy
Product iframe embeds SHALL use explicit sandbox attributes with the minimum permissions needed for the embed use case.

#### Scenario: Lesson media iframe is rendered
- **WHEN** an interactive lesson renders an iframe media preview
- **THEN** the iframe SHALL include a sandbox policy
- **AND** the policy SHALL not grant unnecessary permissions beyond the preview requirement
- **AND** any use of `allow-scripts` together with `allow-same-origin` SHALL have an explicit documented justification and a regression guard

#### Scenario: Review page iframe is rendered
- **WHEN** an adaptive assessment figure review page renders a route preview iframe
- **THEN** the iframe SHALL include a sandbox policy
- **AND** the policy SHALL preserve the review preview behavior
- **AND** each sandbox permission SHALL be traceable to the preview behavior it enables

### Requirement: Inline markup is constrained
Root layout and handout print inline markup SHALL be replaced with safer constructs or constrained to audited static content.

#### Scenario: Theme initialization runs
- **WHEN** the root layout initializes theme state before hydration
- **THEN** the implementation SHALL avoid arbitrary user-controlled HTML or script injection
- **AND** theme switching SHALL continue without hydration mismatch

#### Scenario: Handout print styles render
- **WHEN** a lesson handout print page renders CSS for print formatting
- **THEN** style content SHALL come from trusted static project code
- **AND** user-provided lesson content SHALL NOT be interpolated into inline markup
