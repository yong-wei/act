## ADDED Requirements

### Requirement: Learner data surfaces share one product shell
The adaptive learning center SHALL provide a shared learner data shell for dashboard, profile, growth center, evidence, adaptive practice, and recommended path surfaces.

#### Scenario: Student opens a learner data route
- **WHEN** `/dashboard`, `/profile`, `/profile/growth`, `/profile/evidence`, `/assessment/adaptive-practice`, or a recommended path surface renders
- **THEN** the surface SHALL use consistent ability dimensions, evidence status, current path, recommendation, and next-action semantics
- **AND** it SHALL preserve route identity without presenting each page as a separate product.

### Requirement: Recommended paths render as staged learning routes
The adaptive learning center SHALL render recommendations as staged route nodes where path data is available.

#### Scenario: Recommended path exists
- **WHEN** a student has an active or recommended learning path
- **THEN** the UI SHALL show stage, node, priority, confidence or evidence limitation, expected effort, source context, and launch action
- **AND** it SHALL distinguish current node, completed nodes, blocked nodes, and optional alternatives.

### Requirement: Learner data empty states are actionable
The adaptive learning center SHALL render empty, stale, low-confidence, and no-data states as complete learner-facing states.

#### Scenario: Learner data is incomplete
- **WHEN** ability profile, evidence, path, recommendation, or practice data is missing or low confidence
- **THEN** the surface SHALL explain the limitation and provide adjacent actions such as start practice, review evidence, open Interactive Learning, or enter a simulation/Arena task where available.
