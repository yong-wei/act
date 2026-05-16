## Context

Arena already defines `composite-compensation` as an allowed method and the controller artifact builder can produce composite artifacts. The current user surface is still a course lesson page with a submission mount. That is not a suitable long-term design environment.

## Goals / Non-Goals

**Goals:**
- Provide a unified workbench preset for composite compensation tasks.
- Model composite control as a parameterized template first.
- Show views that match composite control: time response, control effort, error/disturbance, and structure summary.

**Non-Goals:**
- No arbitrary block-diagram editor.
- No symbolic transfer-function algebra for every custom structure.
- No new official metric protocol in the first version.

## Decisions

- Use a bounded parameter template.
  Rationale: arbitrary diagrams need a larger graph editor and evaluator. The existing Arena task only needs a stable first composite template.

- Keep official scoring through existing template white-box behavior first.
  Rationale: `composite-compensation` is already supported by the heuristic template provider. A separate exact analysis provider can be added after the UI is useful.

- Keep lesson-05 out of the workbench path.
  Rationale: lesson pages teach concepts; Arena workbenches produce artifacts and submissions.

## Risks / Trade-offs

- [Risk] Template evaluation may be less physically exact than PID/serial analysis.
  → Mitigation: label it as parameterized template evaluation until an exact analysis provider exists.

- [Risk] Users may expect free block-diagram editing.
  → Mitigation: name the panel as a fixed composite template and constrain controls visibly.
