## ADDED Requirements

### Requirement: Konling grounds answers in knowledge and capability context
Konling SHALL ground supported teaching-assistant answers in server-owned knowledge node, capability target, resource, learner, path, and citation context where available.

#### Scenario: Concept explanation is requested
- **WHEN** a student asks for a factual course concept explanation
- **THEN** Konling SHALL identify relevant knowledge nodes or resource context where available
- **AND** the answer SHALL prioritize verified teaching knowledge citations over learner evidence unless it makes a personalized claim.

#### Scenario: Personalized path advice is requested
- **WHEN** a student asks why a path, node, or resource is recommended
- **THEN** Konling SHALL ground the answer in capability targets, ResourceNode or PlanningUnit rationale, selected path context, and authorized learner evidence where available
- **AND** missing citation classes or low-confidence evidence SHALL be disclosed as limitations.

#### Scenario: Grading or mastery-impacting advice is generated
- **WHEN** Konling generates grading explanation, mastery advice, or diagnosis-affecting output
- **THEN** generated text SHALL remain explanatory unless a governed tool run, approved grading workflow, or materialized evidence summary records the outcome
- **AND** raw assistant narrative SHALL NOT directly update learner mastery.
