## ADDED Requirements

### Requirement: Personal Center dispatch page consolidates learner record modules
The Personal Center route SHALL consolidate student dashboard and profile semantics into one AppShell-backed dispatch page.

#### Scenario: Personal Center renders
- **WHEN** an authenticated student opens the canonical Personal Center
- **THEN** the first viewport SHALL identify the current learner record, next action, evidence status, and key module routes without duplicating dashboard and profile hero sections
- **AND** the page SHALL include access to competency profile, learning statistics, recent activity, personalized reinforcement, evidence review, Arena summary where available, and class join or class binding actions.

#### Scenario: Learner data is incomplete
- **WHEN** profile, activity, Arena, or adaptive data is missing
- **THEN** the page SHALL show honest empty or limited states and preserve primary next actions
- **AND** it SHALL NOT hide the Personal Center behind a generic loading or disconnected profile page.
