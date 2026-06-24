## 1. Goal Registry And Planner Contract

- [x] 1.1 Define a registered learning-goal contract with goal id, display name, allowed resource mix, starter-path policy, checkpoint policy, and explanation templates.
- [x] 1.2 Convert `control-correction` into a registered goal strategy instead of route-local hard-coding.
- [x] 1.3 Update path generation inputs so callers may request generic goals, time budget, difficulty rhythm, resource preferences, and external-resource permission.

## 2. Cold-Start Path Generation

- [x] 2.1 Ensure no-evidence and low-evidence users receive executable starter paths rather than an empty plan.
- [x] 2.2 Keep personalization confidence and diagnostic gaps internally without clearing usable path nodes.
- [x] 2.3 Add fixtures for cold-start, partial-evidence, and existing control-correction users.
- [x] 2.4 Add regression tests proving starter paths still enforce prerequisites, availability, teacher policy, privacy, device, risk-intervention, and time constraints.

## 3. Generic Path Persistence

- [x] 3.1 Persist generic path rounds with goal id, planner version, selected option, current node, path payload, explanation payload, and alternatives.
- [x] 3.2 Preserve legacy control-correction reads through a documented mapper during migration.
- [x] 3.3 Record generation, selection, rejection, switch, execution, deviation, and Konling-adjustment events as generic path activity.

## 4. Verification

- [x] 4.1 Add tests that `/api/learning-paths/plan` accepts non-control-correction registered goals and rejects only unknown goals.
- [x] 4.2 Add tests proving cold-start generation returns at least two executable path options with checkpoints.
- [x] 4.3 Add tests proving `goal=control-correction` still restores current node, completed nodes, failed nodes, alternatives, terminal validation state, and evidence confidence markers.
- [x] 4.4 Add tests proving forbidden internal reason strings are absent from student-facing path payloads.
- [x] 4.5 Run `rtk openspec validate generalize-adaptive-learning-path-generation --strict`.
