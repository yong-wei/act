## Context

Existing path records can show node progress, but the design requires each complex node to produce a visible result record and a governed input for later recommendation. Without outcome binding, heavy nodes appear completed or actionable without evidence that the student actually completed the required assessment, simulation, workbench, or Arena task.

## Goals / Non-Goals

**Goals:**

- Bind complex-node outcomes to path execution records.
- Display result cards with student-safe summaries and evidence status.
- Prevent dependent node advancement when required outcome refs are absent.
- Record missing bindings as auditable governance issues.

**Non-Goals:**

- Rebuilding Arena scoring or simulation engines.
- Changing leaderboard authority.
- Replacing existing evidence outbox or learner fact governance.

## Decisions

- Complex-node completion is not a simple UI click. It requires a typed outcome reference such as `adaptiveAssessmentRef`, `simulationRef`, `controlWorkbenchRef`, or `arenaRef`.
- Result cards use the path node as the student-facing anchor and the source system as provenance.
- Missing bindings are not treated as failures of the student. The UI shows `结果待同步`, and the system does not advance dependent nodes until the binding exists or policy explicitly allows a fallback.
- Continued interaction with a completed node appends new evidence without re-completing the original node.

## Risks / Trade-offs

- Some legacy nodes may not have a source ref. Mitigation: render `结果待同步` and add backfill or repair tasks before relying on the result.
- Outcome schemas vary by source. Mitigation: use typed summaries per node class and keep raw source payloads in their owning systems.
- Blocking advancement can reveal data lag. Mitigation: provide refresh and return-to-current-node actions.
