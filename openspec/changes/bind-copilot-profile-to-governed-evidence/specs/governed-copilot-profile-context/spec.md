## ADDED Requirements

### Requirement: Copilot profile context SHALL be server-owned

The Copilot SHALL derive learner profile facts from the authenticated learner and governed server state. Client-supplied profile identity, learning style, cognitive level, ability vector, class, or fleet fields MUST NOT be used as learner facts.

#### Scenario: Client submits a forged profile

- **WHEN** an authenticated learner submits a `userProfile` with another user ID or altered ability values
- **THEN** the server ignores or rejects those profile fields before prompt construction
- **AND** the generated context remains scoped to the authenticated learner

#### Scenario: Client omits the profile

- **WHEN** an authenticated learner sends a normal Copilot request without `userProfile`
- **THEN** the server resolves the profile from its governed state when available
- **AND** the request does not require a browser-generated default profile

### Requirement: Profile availability SHALL remain explicit

The server SHALL preserve whether the governed profile is available, missing, low-confidence, stale, or unavailable. Unknown profile values MUST NOT be normalized into personal zeroes or default ability values.

#### Scenario: No governed profile evidence exists

- **WHEN** the authenticated learner has no usable governed profile evidence
- **THEN** Copilot enters a cold-start or missing-profile state
- **AND** it provides course-grounded general help or a real evidence-creation action
- **AND** it does not claim a personal learning style, ability, achievement, or progress

#### Scenario: Profile service is unavailable

- **WHEN** the governed profile service cannot be read
- **THEN** Copilot marks personalization as unavailable
- **AND** it continues only with non-personalized page or course context
- **AND** it does not silently substitute a client or hard-coded profile

### Requirement: Page context SHALL remain bounded

The Copilot MAY use server-validated page and course location to tailor general explanations, but client page hints MUST NOT expand learner data access or override governed profile limitations.

#### Scenario: Client changes page hints

- **WHEN** the client changes topic, course, or step hints without matching an authorized page context
- **THEN** the server rejects or bounds the hints according to the existing context contract
- **AND** the request cannot use them to create a new learner fact or profile conclusion

### Requirement: Existing generic chat SHALL remain compatible

Normal authenticated Copilot requests without learner profile evidence SHALL continue to receive course-grounded general assistance, subject to explicit personalization limitations. The change SHALL NOT write official scores, LearningFact, rankings, or learner profile updates.

#### Scenario: General learning question without personalization

- **WHEN** a learner asks a course question while governed profile data is missing
- **THEN** the response remains available as general course assistance
- **AND** its context records do not contain fabricated personal profile claims
