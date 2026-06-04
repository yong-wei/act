## Context

The current planner already scores nodes and returns main paths, alternatives, explanations, feedback events, and visualization payloads. Active changes will make those paths durable for control correction. The missing product behavior is a strategy layer that can intentionally produce meaningfully different routes.

## Goals / Non-Goals

**Goals:**

- Add path policy family metadata and strategy-specific scoring weights.
- Support at least foundation-remediation, simulation-driven, sprint-correction, and teacher-assigned strategy families.
- Measure resource overlap, modality mix, terminal validation style, and estimated effort differences across displayed paths.
- Preserve existing planner and recommendation compatibility.

**Non-Goals:**

- Introducing black-box reinforcement learning.
- Replacing ResourceNode registry semantics.
- Building the student center page.

## Decisions

### Decision 1: Policy families are explicit planner inputs

Callers should request a policy family or request a multi-policy bundle. Hidden UI-only relabeling is not acceptable.

### Decision 2: Diversity is testable

Displayed alternatives must satisfy overlap and modality constraints unless the planner returns an explicit low-resource fallback.

### Decision 3: Teacher policy remains authoritative

Teacher-only, teacher-assigned, blocked, privacy, and terminal validation rules from ResourceNode metadata remain constraints across all policy families.

## Validation

- Planner tests SHALL prove each policy family produces expected modality and rationale differences on a shared fixture graph.
- Multi-path tests SHALL enforce an overlap threshold or explicit low-resource fallback.
- `rtk openspec validate extend-adaptive-path-policy-families --strict` SHALL pass.
