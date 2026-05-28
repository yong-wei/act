## ADDED Requirements

### Requirement: Konling reads server-owned adaptive context
Konling SHALL build runtime context from server-owned page context, learner state, plan context, and scoped memory rather than default or client-provided profile values.

#### Scenario: Konling context is loaded
- **WHEN** Konling starts or receives a message on a supported page
- **THEN** it SHALL load page context, learner state, current plan context, recent evidence, relevant memory summaries, and permitted tools
- **AND** missing or low-confidence context SHALL be visible to prompt construction and response rationale.

### Requirement: Konling exposes adaptive-learning tools
Konling SHALL expose tools for page, learner, plan, memory, knowledge graph, next action, simulation status, intervention, and attempt analysis.

#### Scenario: Default tools are available
- **WHEN** Konling handles a learning-support conversation
- **THEN** it SHALL be able to call `get_page_context`, `get_learner_state`, `get_plan_context`, `search_learning_memory`, `search_knowledge_graph`, `recommend_next_action`, `get_simulation_status`, `record_intervention_result`, and `analyze_attempt`
- **AND** each tool SHALL enforce user, class, resource, path, and privacy scope.

### Requirement: Konling memory is staged and scoped
Konling SHALL persist Stage 1 memory at working-summary, session-summary, episodic, and intervention-outcome levels.

#### Scenario: Conversation creates memory summary
- **WHEN** a Konling conversation produces durable learning insight, repeated confusion, preference, or intervention outcome
- **THEN** the system SHALL persist a privacy-scoped memory summary
- **AND** raw dialogue text SHALL NOT be required in learner-state or teacher-facing payloads.

#### Scenario: Long-term memory is not yet enabled
- **WHEN** Stage 1 Konling runtime is active
- **THEN** semantic learner memory and strategy memory SHALL remain feature-flagged or disabled
- **AND** enabling them later SHALL require privacy audit coverage, evaluation metrics, and persisted intervention outcomes.

### Requirement: Konling interventions are governed
Konling SHALL support corrective and remedial interventions grounded in learner state and path context.

#### Scenario: Intervention is generated
- **WHEN** Konling intervenes because of risk, stagnation, path deviation, or repeated failure
- **THEN** the intervention SHALL explain why now, which evidence supports it, and what alternatives exist
- **AND** it SHALL respect cooldowns, teacher policy, privacy scope, and student feedback history.

#### Scenario: Intervention outcome is recorded
- **WHEN** a student accepts, dismisses, or rates an intervention
- **THEN** the system SHALL persist the outcome
- **AND** the outcome SHALL be available to learner state and path evaluation within privacy limits.
