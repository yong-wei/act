## Context

The report frames Konling as a page-context assistant, trajectory explainer, intervention executor, and memory agent. The MVP should first connect it to real learner/page/path state and remedial/corrective interventions.

## Decisions

### Server context is authoritative

Konling prompt construction uses server tools for page context, learner state, plan context, evidence, and scoped memory. Client-provided profile values may be hints but cannot override server state.

### Keep memory staged

Stage 1 persists working summaries, session summaries, episodic learner memories, and intervention outcomes. Long-term semantic learner memory and strategy memory require later privacy and evaluation gates.

### Interventions are governed

Interventions explain why now, which evidence supports them, and what alternatives exist. Cooldowns, teacher policy, privacy scope, and feedback history are required.

## Risks / Trade-offs

- Over-intervention can harm learning experience; cooldown and policy checks are mandatory.
- Memory can expose sensitive data; raw dialogue is not required in learner-state or teacher-facing payloads.

## Migration Plan

1. Add tool router contracts and authorization checks.
2. Switch prompt/context construction to server state.
3. Persist scoped summaries and intervention outcomes.
4. Add remedial/corrective intervention flows.
5. Leave long-term strategy memory to Stage 2.

## Open Questions

- None.
