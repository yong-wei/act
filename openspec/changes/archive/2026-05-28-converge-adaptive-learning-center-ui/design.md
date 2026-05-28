## Context

Adaptive learning currently appears as personal learning cards, a Copilot page, adaptive practice, and profile recommendations. Future contracts require a coherent loop: assess, read learner state, plan, explain evidence, practice, intervene, and record outcomes.

## Goals / Non-Goals

Goals:

- Define one student-facing adaptive center with tabbed or segmented views for overview, state, mastery, path, evidence, practice, and Konling.
- Preserve existing adaptive and AI routes during migration.
- Make confidence and fallback states central to the experience.

Non-goals:

- No learner-state, path-planner, assessment, or Konling backend implementation in this change.
- No Stage 2 bandit or experiment UI.
- No replacement of teacher/admin governance views.

## Decisions

### Adaptive center is the student loop

The UI should make the adaptive sequence inspectable: current state, why it thinks that, what path is next, what evidence supports it, what practice is recommended, and how Konling can intervene.

### Compatibility routes stay alive

Existing `/ai`, `/ai/copilot`, `/assessment/adaptive-practice`, and profile recommendation surfaces remain available until the center has equivalent behavior and tests.

## Risks

- The center can imply precision before evidence is ready. It must surface source coverage, confidence, and fallback reasons.
- Konling can look like a generic chat if not tied to path and learner state. It must display context source and intervention basis.

## Verification

- Tests for old-route compatibility, feature-flag behavior, path view payload rendering, and low-confidence states.
- Browser checks for mobile and desktop center layout once implemented.
