## Context

The report recommends a compact path graph rather than a full course rewrite. Existing ResourceNode contracts already support the required node types and audit fields. This change supplies the control-correction-specific seed data and path eligibility checks.

## Goals / Non-Goals

**Goals:**

- Seed a minimal but complete control-correction path graph.
- Include prerequisites, remedial, alternative, related, and terminal edges.
- Include estimated time, cognitive load, knowledge coverage, ability impact, launch target, and evidence instrumentation.
- Ensure all path-eligible nodes pass registry audit.

**Non-Goals:**

- Generating personalized paths.
- Changing resource rendering implementations.
- Creating new course content authoring flows.

## Decisions

### Decision 1: Seed graph is versioned

The graph should include a seed version so persisted paths can later state which resource graph produced them.

### Decision 2: Terminal validation is part of graph metadata

Simulation and Arena nodes must be identifiable as terminal or transfer-validation nodes, not just normal resources.

### Decision 3: Invalid nodes are kept out of path eligibility

The audit should preserve diagnostic reasons but prevent incomplete nodes from entering generated learning paths.

## Validation

- Registry audit tests SHALL reject nodes missing launch targets, knowledge mapping, evidence instrumentation, or privacy policy.
- Planner fixtures SHALL prove the seeded graph can produce at least one feasible path that includes simulation and ends with Arena validation.
- `rtk openspec validate seed-control-correction-resource-path-graph --strict` SHALL pass.
