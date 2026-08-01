## ADDED Requirements

### Requirement: Planner honors explicit personalized path configuration
The adaptive learning path planner SHALL treat request-level resource preferences, difficulty rhythm, checkpoint preference, and external-resource permission as planning inputs that affect candidate selection or path assembly. Goal boundaries, prerequisites, readiness, teacher policy, privacy, terminal validation, evidence policy, and safety constraints SHALL remain higher-priority constraints.

#### Scenario: Request-level resource preference overrides stored preference
- **WHEN** a request explicitly provides one or more resource types that differ from stored learner preferences
- **THEN** the planner SHALL use the request-level resource types for that generation
- **AND** it SHALL use stored preferences only when the corresponding request value is omitted.

#### Scenario: Feasible contrasting configurations are generated
- **WHEN** the same learner state and resource pool contain feasible alternatives for two contrasting configurations
- **THEN** the resulting paths SHALL differ in at least one non-mandatory instructional resource or in the retained option count
- **AND** a scoring or explanation-text difference alone SHALL NOT satisfy this requirement.

#### Scenario: A requested configuration cannot be fulfilled
- **WHEN** a request-level configuration conflicts with higher-priority constraints or the audited resource pool cannot satisfy it
- **THEN** the planner SHALL retain the higher-priority constraints
- **AND** it SHALL return a structured unmet-configuration reason rather than silently treating the configuration as a weak score signal.

### Requirement: Planner maps free-text intent to governed planning concepts
The planner SHALL accept free-text path intent only through deterministic mappings to supported resource types, difficulty rhythm, checkpoint density, external-resource permission, registered goals, or graph targets. Client text SHALL NOT expand resource access, evidence authority, graph boundaries, or permissions.

#### Scenario: Free-text intent maps to supported concepts
- **WHEN** a student's free-text intent matches supported planning vocabulary
- **THEN** the request SHALL produce typed planning inputs with mapping evidence
- **AND** those inputs SHALL follow the same fulfillment and higher-priority-constraint rules as structured configuration.

#### Scenario: Free-text intent is unsupported or infeasible
- **WHEN** free-text intent cannot be mapped deterministically or cannot be satisfied by audited resources and constraints
- **THEN** the planner SHALL return a structured unmet reason in student-safe form
- **AND** it SHALL NOT pass raw text to an unrestricted semantic planner or claim that the intent changed the path.

### Requirement: Policy bundles select meaningful path alternatives during generation
When generating multiple policy-family options, the planner SHALL generate options in deterministic priority order and avoid the differentiable instructional resources already retained by earlier options. Mandatory prerequisite and terminal-validation resources MAY be shared.

#### Scenario: Later policy option has a feasible alternative
- **WHEN** a later policy family has an alternative path that satisfies all required constraints without reusing every differentiable instructional resource of an earlier retained option
- **THEN** the planner SHALL retain that alternative
- **AND** the bundle SHALL identify its differentiable-resource distinction through its normal comparison data.

#### Scenario: Later policy option has no meaningful alternative
- **WHEN** a later policy family cannot satisfy goal, prerequisite, readiness, terminal-validation, and personalization constraints without cosmetic reuse
- **THEN** the planner SHALL omit that option
- **AND** it SHALL return a student-safe limitation explaining the reduced option count.

#### Scenario: Mandatory nodes are shared
- **WHEN** multiple retained options require the same prerequisite repair or terminal-validation node
- **THEN** the planner MAY retain that shared node in each option
- **AND** it SHALL evaluate meaningful distinction on the remaining differentiable instructional resources.

### Requirement: Planner preserves requested budget when validation is required
The planner SHALL preserve the student's requested time budget as the request constraint. When mandatory terminal validation makes the request infeasible, it SHALL return the minimum executable duration and a structured budget limitation instead of silently increasing the requested budget or removing validation.

#### Scenario: Requested budget is below the executable minimum
- **WHEN** a registered goal requires terminal validation and the requested budget is below the minimum feasible duration
- **THEN** the planner SHALL not generate a path that represents the higher duration as requested
- **AND** it SHALL return the requested duration, the minimum executable duration, and a student-safe corrective action.
