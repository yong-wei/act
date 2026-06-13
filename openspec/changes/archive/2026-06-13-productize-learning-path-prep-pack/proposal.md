## Why

The project already records three-style path choices and supports prep-pack overlays, but the learner and teacher product surfaces do not yet form a clear competition loop. The next step is to turn existing path and prep-pack primitives into a visible flow: diagnose, compare paths, choose, execute, summarize validation, generate teacher intervention, activate overlay, and collect impact evidence.

## What Changes

- Add a student path center that compares distinct path styles, records choice evidence, shows execution checkpoints, and summarizes terminal validation.
- Link student diagnosis next actions to path comparison and path advisor context.
- Add teacher prep-pack review flow from class diagnosis to candidate review, runtime diff preview, activation, rollback, and impact evidence.
- Ensure prep-pack overlays do not mutate base runtime content and remain scoped to class, lesson, and session anchors.
- Expose path and prep-pack evidence to Konling context without granting publish or writeback authority.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-path-planning`: strengthens student-facing path comparison, selection, execution, and terminal validation requirements.
- `teacher-prep-pack-generation`: strengthens teacher review UI, activation, rollback, runtime-diff, and impact evidence requirements.
- `konling-agent-runtime`: adds path and prep-pack context expectations for advisory support in this product loop.

## Impact

- Affects adaptive practice or learner path routes, path round persistence APIs, diagnosis next-action links, teacher prep-pack surfaces, CourseEnhancementPack overlay operations, Konling mode context, and tests.
- Depends on `freeze-competition-baseline` and `harden-assistant-evidence-loop`; path advice and prep-pack review must consume the shared evidence, citation, and Konling readiness semantics from that upstream change rather than defining a parallel context contract.
- Does not change the core path scoring algorithm or document grading evaluator.
