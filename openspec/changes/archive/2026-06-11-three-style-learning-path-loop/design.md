## Context

The current path planner already supports policy families and distinct path validation. This change turns those capabilities into the assistant closed-loop choice model required by the report.

## Goals / Non-Goals

**Goals:**

- Produce three meaningfully distinct path options from diagnosis snapshots.
- Record student choice and later outcomes as governed evidence.
- Update learner preference and strategy features from observed choices and path results.
- Preserve terminal validation and fallback semantics.

**Non-Goals:**

- Replacing the existing path planner.
- Introducing contextual bandit or reinforcement learning.
- Treating path choice as proof of mastery.

## Decisions

### Decision 1: Path styles are policy families

The three options should map to existing or extended policy families instead of prompt-only labels. Foundation remediation prioritizes prerequisite repair; Arena/simulation sprint prioritizes terminal validation and transfer; preference-matched route prioritizes observed modality and pacing fit.

### Decision 2: Choice is preference evidence, not correctness evidence

A student's selected path updates preference and strategy features. It should not increase mastery until execution evidence supports that change.

### Decision 3: Meaningful distinction is validated

The bundle must expose overlap, modality mix, estimated effort, and terminal validation difference. If resources are insufficient, the response should return a low-resource fallback rather than three cosmetic variants.

## Validation

- Planner tests verify the three path styles are distinct and policy-driven.
- Evidence tests verify selection, rejection, deviation, completion, and helpfulness writeback.
- Learner-state tests verify preference updates do not inflate mastery scores.
- Diagnosis and Konling contract tests verify path options and selection history remain visible through governed summaries.
- `rtk openspec validate three-style-learning-path-loop --strict` passes.
