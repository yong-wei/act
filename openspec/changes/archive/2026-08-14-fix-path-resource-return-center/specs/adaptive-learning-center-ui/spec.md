## MODIFIED Requirements

### Requirement: Adaptive path center preserves path context across states
The adaptive learning center SHALL preserve saved path state while students move between generation, selection, execution, launched resources, the center landing, and evidence review.

#### Scenario: Student selects a generated option
- **WHEN** the student selects a path option
- **THEN** the generation panel SHALL close
- **AND** the route SHALL enter path execution with the selected path id, selected option, current node, and alternatives available for later switching or review.

#### Scenario: Student returns from a resource
- **WHEN** a launched knowledge, exercise, simulation, workbench, Arena, or Konling activity returns to the path center
- **THEN** the route SHALL return to the center landing with the learning goal preserved and without path-execution, node, or candidate-batch parameters
- **AND** the saved path id, current node, and progress SHALL remain available for `继续原路径` without entering candidate comparison.

### Requirement: Path-launched resources return to the path center
The adaptive learning center SHALL provide a path-aware launch and return contract for every resource opened from a selected path. A resource return action SHALL return to the path center entry point, where the saved path can be continued or a new path can be created.

#### Scenario: Student launches a path node
- **WHEN** the student starts a knowledge, interactive lesson, adaptive assessment, simulation, control workbench, Arena, reflection, external resource, or Konling node from the current path
- **THEN** the launch target SHALL receive a normalized path launch context containing source, goal id, path id, node id, route intent, return href, and resource type
- **AND** the visible resource destination SHALL have enough context to identify the originating learning goal and saved path

#### Scenario: Student uses the resource return control
- **WHEN** a resource or course runtime was opened from a valid path launch context
- **THEN** the visible return control SHALL read as `返回学习路径` or equivalent path-specific language
- **AND** it SHALL return to `/assessment/adaptive-practice` with the learning goal preserved
- **AND** it SHALL NOT retain path-execution, node, or candidate-batch parameters that would reopen an execution or comparison workspace

#### Scenario: Student continues a saved path after returning
- **WHEN** the path center receives a return navigation and a saved path exists for the preserved goal
- **THEN** the center SHALL offer `继续原路径`
- **AND** selecting it SHALL restore the saved path progress and current node without entering candidate comparison

#### Scenario: Student creates a new path after returning
- **WHEN** the student selects `新建学习路径` from the path center
- **THEN** the center SHALL start the candidate path generation and comparison flow
- **AND** returning from a resource alone SHALL NOT start that flow

#### Scenario: Resource is opened outside a path
- **WHEN** the same resource is opened from Interactive Learning, a course entry, or another non-path surface
- **THEN** the resource SHALL keep its normal contextual return target
- **AND** it SHALL NOT fabricate a path return when no path launch context exists.

