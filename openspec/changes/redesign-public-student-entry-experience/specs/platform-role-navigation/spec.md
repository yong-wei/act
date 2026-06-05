## ADDED Requirements

### Requirement: Public and auth entries preserve role and destination intent
The system SHALL preserve role and callback intent through public and auth entry surfaces.

#### Scenario: Login is opened with callback
- **WHEN** a user opens `/login?callbackUrl=%2Fprofile` or another callback destination
- **THEN** the login surface SHALL visibly show the intended destination and role/cockpit relationship
- **AND** successful authentication SHALL keep existing callback routing behavior.

### Requirement: Student entry journey connects to evidence review
Student entry navigation SHALL connect learning intent to learner record and evidence review.

#### Scenario: Student completes a primary learning action
- **WHEN** the student follows entry navigation into course, practice, challenge, or experiment work
- **THEN** the return or next-step navigation SHALL offer a path to learner record, evidence timeline, or next recommendation where that evidence is available
- **AND** `/profile`, `/profile/evidence`, and `/data-center` SHALL retain distinct meanings.
