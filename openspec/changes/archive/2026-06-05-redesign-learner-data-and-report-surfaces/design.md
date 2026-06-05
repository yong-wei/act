## Context

Student data surfaces currently share some visual vocabulary, but they need stronger product behavior: what should I do next, why is the recommendation trustworthy, what evidence is missing, and where do I review history?

## Goals / Non-Goals

**Goals:**

- Unify learner record, pathway, evidence timeline, and adaptive practice entry.
- Make low confidence, missing evidence, empty states, loading, and degraded states actionable.
- Keep privacy and evidence source semantics consistent.

**Non-Goals:**

- Do not change learner-state algorithms or fabricate metrics.
- Do not implement teacher reports in this change.

## Decisions

### Decision 1: Learner record is a guided state surface

The page should prioritize current path and next action, then evidence and history. It should not be a set of equal metric cards.

### Decision 2: Missing evidence is product state

Low confidence and missing source coverage must be designed as honest states with next actions, not as empty placeholders.

## Risks / Trade-offs

- Some data may be unavailable. -> Render honest unavailable and missing-evidence states.
- Learner reports overlap with export reports. -> This change handles in-app learner record; report export is a separate change.
