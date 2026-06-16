## Context

The accepted Product Design direction requires the path center to start from the student's real state. The current planner and UI can show heavy nodes as immediate work even when the learner has no capability evidence for those nodes. This change establishes the readiness contract that later UI and execution changes must consume.

## Goals / Non-Goals

**Goals:**

- Add an explicit readiness layer for path nodes and path options.
- Prevent immediately executable heavy nodes for students below required competency or evidence thresholds.
- Preserve heavy nodes as locked future milestones when they are pedagogically useful.
- Provide student-facing preparation messages while retaining internal diagnostics for authorized governance views.

**Non-Goals:**

- Redesigning the full generation panel.
- Implementing result cards for every complex node.
- Replacing existing learner-state or evidence-cache models.

## Decisions

- Readiness metadata belongs on governed ResourceNodes and generated checkpoint contracts, because the planner must evaluate it before UI rendering.
- The planner returns both active and locked node ids. This keeps aspirational route structure visible without making locked work executable.
- Low ability should route to preparation nodes, not to a heavier challenge. For `20230010102601`, zero control-modeling or parameter-design competency blocks immediate Arena activation.
- Student UI receives messages such as `Arena 暂未解锁，完成仿真验证后会自动进入。`; internal labels such as `locked`, `reasonCodes`, or `terminal-validation-unavailable` remain off student-visible surfaces.

## Risks / Trade-offs

- Existing paths may lack metadata. Mitigation: treat missing readiness metadata on heavy nodes as locked until audited metadata exists.
- Over-gating could hide useful exploration. Mitigation: allow locked nodes to appear as future milestones and provide fallback preparation nodes.
- The first implementation may only cover registered adaptive goals. Mitigation: unknown goals continue to use existing governed rejection behavior.
