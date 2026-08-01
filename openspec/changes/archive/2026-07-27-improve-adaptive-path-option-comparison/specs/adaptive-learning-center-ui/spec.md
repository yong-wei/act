## ADDED Requirements

### Requirement: Generated path comparison exposes ordered resource previews
The adaptive learning center SHALL present every generated, selectable path option as an ordered, read-only preview before the student chooses it. The preview SHALL use the planner-provided node order and node summaries, show the first four contiguous nodes by default, and allow the student to disclose the full route without launching a resource.

#### Scenario: Generated options include ordered node summaries
- **WHEN** the path center receives multiple generated options with ordered `nodeIds` and `nodeSummaries`
- **THEN** each formal comparison option SHALL show concrete resource title, resource type, single-node estimated time, and student-facing readiness state in the planner order
- **AND** the option SHALL reveal the remaining route through an in-module disclosure when it contains more than four nodes

#### Scenario: Generated option contains a locked node
- **WHEN** an ordered preview includes a locked node
- **THEN** the node SHALL show a student-facing locked state and its preparation or unlock condition
- **AND** the node SHALL remain non-startable until the student selects a path and receives an authorized execution context

#### Scenario: Historic path payload lacks usable node summaries
- **WHEN** an option lacks usable ordered node summaries
- **THEN** the comparison surface SHALL retain its other student-facing fields and explain that the detailed route is unavailable
- **AND** it SHALL NOT invent resource titles, order, or readiness details

### Requirement: Generated path comparison explains overlap and diversity limits
The adaptive learning center SHALL explain meaningful path differences from stable resource-node identity across the currently generated comparison set.

#### Scenario: A resource appears in all generated options
- **WHEN** the same `nodeId` occurs in every generated, selectable option
- **THEN** each occurrence SHALL be labelled “所有方案均包含”

#### Scenario: A resource appears in only one generated option
- **WHEN** a `nodeId` occurs in exactly one generated, selectable option
- **THEN** that occurrence SHALL be labelled “本方案特有”

#### Scenario: Existing planner data reports insufficient distinction
- **WHEN** existing planner diversity or limitation data establishes that available resources cannot produce meaningfully distinct options
- **THEN** the comparison region SHALL display “当前可用资源有限，推荐方案差异较小” in student-facing language
- **AND** students SHALL retain access to the route previews and path-selection actions

### Requirement: Starter examples are distinct from formal path comparisons
The adaptive learning center SHALL distinguish pre-generation starter examples from generated path options.

#### Scenario: The learner has no generated path options
- **WHEN** the path center displays starter learning approaches before a planner response
- **THEN** the UI SHALL identify them as examples rather than formal comparable paths
- **AND** it SHALL NOT apply generated-node ordering, overlap, uniqueness, or formal selection semantics to them
