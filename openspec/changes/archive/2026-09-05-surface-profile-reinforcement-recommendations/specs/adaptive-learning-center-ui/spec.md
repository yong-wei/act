## MODIFIED Requirements

### Requirement: Learner data surfaces share one product shell
The adaptive learning center SHALL provide a shared learner data shell for dashboard, profile, growth center, evidence, adaptive practice, and recommended path surfaces. The profile surface SHALL populate its personalized reinforcement area from the governed personalization output when recommendations are available.

#### Scenario: Student opens a learner data route
- **WHEN** `/dashboard`, `/profile`, `/profile/growth`, `/profile/evidence`, `/assessment/adaptive-practice`, or a recommended path surface renders
- **THEN** the surface SHALL use consistent ability dimensions, evidence status, current path, recommendation, and next-action semantics
- **AND** it SHALL preserve route identity without presenting each page as a separate product.

#### Scenario: Profile shows governed reinforcement resources
- **WHEN** an authenticated student has eligible governed recommendations
- **THEN** `/profile` SHALL show the mapped resource cards in the personalized reinforcement area
- **AND** each card SHALL preserve its student-facing title, reason, priority, evidence limitation or confidence metadata, and launch action
- **AND** the launch action SHALL enter the corresponding real learning resource or path flow.

#### Scenario: Profile has no usable recommendation
- **WHEN** the recommendation policy returns no usable result because evidence is missing, stale, partial, unavailable, or no candidate is eligible
- **THEN** `/profile` SHALL show an explicit student-facing limited state
- **AND** it SHALL provide an adjacent evidence-gathering or starter-learning action
- **AND** it SHALL NOT fabricate a personalized resource, mastery claim, or precise diagnosis.
