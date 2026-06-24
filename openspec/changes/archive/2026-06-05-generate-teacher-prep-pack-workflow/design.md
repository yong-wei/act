## Context

The repository already has preset lessons, class sessions, resource registry, teacher insight APIs, and future adaptive reports. The missing piece is a governed object that translates class-level diagnosis into a next-class enhancement plan while preserving the teacher's course structure.

## Goals / Non-Goals

**Goals:**

- Define prep-pack inputs from class diagnosis, report metrics, learner-state aggregates, path outcomes, grading summaries, and upcoming lesson context.
- Generate candidate interventions tied to ResourceNodes, interactive lesson steps, knowledge cards, micro-simulations, Arena tasks, reflection prompts, or Konling prompts.
- Expose methodology, evidence references, affected group, confidence, estimated time, and insertion target for every candidate.
- Require teacher review, edit, approve, reject, or export actions.

**Non-Goals:**

- Automatically publishing generated resources to students without teacher approval.
- Replacing lesson authoring or BOPPPS design.
- Generating arbitrary free-form content without resource or evidence linkage.

## Decisions

### Decision 1: Prep packs are constrained recommendations

Each item must map to an existing resource, registered goal, lesson slot, or explicitly marked draft resource request.

### Decision 2: Teacher controls publication

Generated prep packs are drafts until a teacher approves or exports them.

### Decision 3: Methodology is visible

Teachers need to see why an item is proposed, who it affects, what evidence supports it, and what confidence limits apply.

## Validation

- Tests SHALL prove prep items include evidence, affected population, insertion target, confidence, and teacher review state.
- Tests SHALL prevent raw student data or private Konling memory from appearing in ordinary prep-pack payloads.
- `rtk openspec validate generate-teacher-prep-pack-workflow --strict` SHALL pass.
