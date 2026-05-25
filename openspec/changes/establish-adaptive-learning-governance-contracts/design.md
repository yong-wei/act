## Context

The large `build-xh202620-adaptive-learning-platform` proposal contains valid ideas but mixes shared policy with multiple executable subsystems. This change extracts the shared contract so later changes can remain small and still agree on prerequisites, privacy, evaluation, compatibility, and handoff artifacts.

## Decisions

### Use an explicit prerequisite gate

Later changes that consume simulation or Arena data must stop until the seven upstream virtual-simulation changes have no remaining tasks, pass strict validation, and expose their promised protocol, replay, evidence, resource, shell, and feature contracts.

### Treat privacy and evaluation as common contracts

Every adaptive-learning payload must declare role scope and privacy level before implementation. Every path, learner-state, assessment, and Konling event that supports evaluation must share a stable event envelope so Stage 2 experiments do not reinterpret Stage 1 telemetry.

### Preserve current surfaces behind feature flags

Existing profile, recommendation, classroom, resource, and chat routes remain compatibility surfaces. Later changes introduce new services behind flags and must document rollback behavior.

## Risks / Trade-offs

- This change has little visible product value by itself, but it prevents later changes from inventing incompatible payload shapes.
- Over-specifying every field here would block useful iteration, so field-level contracts stay in the owning subsystem changes.

## Migration Plan

1. Add this contract as the first XH-202620 child change.
2. Make later child issues depend on it.
3. Use its privacy, evaluation, and rollback requirements as review gates.

## Open Questions

- None.
