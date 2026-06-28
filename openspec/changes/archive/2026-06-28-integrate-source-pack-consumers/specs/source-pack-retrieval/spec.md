## ADDED Requirements

### Requirement: Authoring workflows consume Source Packs for large resources
Lesson and homework authoring workflows SHALL use Source Packs as the governed reference path for large textbooks, references, and multimedia transcripts.

#### Scenario: Lesson skill needs textbook context
- **WHEN** a lesson-authoring workflow needs evidence from large textbooks or references
- **THEN** it SHALL request a Source Pack through the shared builder or CLI
- **AND** it SHALL consume compact Markdown or JSON evidence instead of loading full books into agent context.

#### Scenario: Homework skill needs reviewed references
- **WHEN** an assessment or homework workflow needs references
- **THEN** it SHALL use an authoring or assessment Source Pack profile
- **AND** it SHALL preserve citation ids and audit output for later review.

### Requirement: Konling uses Source Packs for query-aware content citations
Konling SHALL use Source Pack evidence for teaching-content citations when answering scoped learning questions.

#### Scenario: Concept explanation is requested from a graph context
- **WHEN** a learner asks Konling to explain a selected concept, resource, or page context
- **THEN** Konling SHALL build or receive a `konling-answer` Source Pack using the question and server-owned context
- **AND** it SHALL pass verified content citations into the answer-generation and citation-verification path.

#### Scenario: Learner personalization evidence is missing
- **WHEN** learner state, path execution, or personalized evidence is unavailable
- **THEN** Konling SHALL still return content-grounded cited answers when eligible teaching-content citations are available
- **AND** missing personalization SHALL be represented as a limitation on style, scope, or confidence rather than a failure of teaching-content retrieval.

### Requirement: Path planning consumes Source Packs as evidence
Adaptive path planning SHALL consume Source Packs as goal-aligned resource evidence without bypassing ResourceNode and PlanningUnit governance.

#### Scenario: Planner evaluates a LearningGoal
- **WHEN** path planning receives a LearningGoal, knowledge target, capability target, learner state, or graph context
- **THEN** it MAY request a `path-planning` Source Pack to explain relevant resources, citations, and missing coverage
- **AND** actual path nodes SHALL still be selected only from audited ResourceNode or PlanningUnit candidates.

#### Scenario: Citation-only material matches a goal
- **WHEN** a Source Pack item is relevant but lacks path eligibility
- **THEN** the planner MAY use it as supporting evidence or explanation
- **AND** it SHALL NOT insert that item as a PathNode.
