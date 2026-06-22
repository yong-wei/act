## Context

The final audit repeatedly follows `assignment=report-control-design` through student pages. Each target opens, but none treats it as one feedback task. This change turns those disconnected destinations into a single learner-facing state machine.

## Goals / Non-Goals

**Goals:**
- Preserve assignment and criterion context through student remediation tasks.
- Produce visible writeback to evidence, growth, and portfolio.
- Make missing API support explicit and recoverable.

**Non-Goals:**
- Do not implement teacher grading approval; that belongs to the teacher report/grading change.
- Do not redesign the entire adaptive-learning engine.

## Decisions

- The feedback task context must be a typed object, not just query strings passed through links.
- Completion must update at least one durable target or explicitly explain why writeback is unavailable.
- Portfolio collection starts as a draft/candidate state to avoid silently publishing weak evidence.

## Risks / Trade-offs

- Existing demo states may not have durable persistence. Mitigation: distinguish demo completion from persisted writeback in UI and tests.
- Assignment context may conflict with older generic pages. Mitigation: show an explicit scoped banner and fallback return path.
