## Why

Konling currently has UI and chat scaffolding but lacks authoritative learner state, current task/path context, governed memory, and intervention outcomes. This change upgrades Konling after learner-state and path-planning contracts exist, without bundling unrelated path or resource implementation.

## What Changes

- Load Konling context from server-owned page context, learner state, plan context, and scoped memory.
- Add tool contracts for page context, learner state, plan context, learning memory, knowledge graph, next action, simulation status, intervention result recording, and attempt analysis.
- Persist working summaries, session summaries, episodic learner memories, and intervention outcomes with privacy controls.
- Implement corrective and remedial interventions with why-now/evidence/alternatives explanations, cooldowns, teacher policy checks, and feedback recording.
- Defer long-term semantic learner memory and strategy memory to the optimization change.

## Capabilities

### New Capabilities
- `konling-agent-runtime`: Defines state-aware context loading, adaptive tools, scoped memory, and governed interventions.

### Modified Capabilities
- None.

## Impact

- Affects `src/app/api/ai/**`, Konling context/prompt construction, memory persistence, and intervention feedback.
- Depends on `build-adaptive-learner-state-service` and `implement-rule-graph-learning-path-mvp`.
