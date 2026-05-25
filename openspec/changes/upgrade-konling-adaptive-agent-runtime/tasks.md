## 1. Context and Tools

- [ ] 1.1 Add server tools for `get_page_context`, `get_learner_state`, `get_plan_context`, `search_learning_memory`, `search_knowledge_graph`, `recommend_next_action`, `get_simulation_status`, `record_intervention_result`, and `analyze_attempt`.
- [ ] 1.2 Enforce user, class, resource, path, and privacy scope on each tool.
- [ ] 1.3 Change Konling prompt/context construction to use server learner state and plan context instead of default or client-provided profile values.

## 2. Memory and Interventions

- [ ] 2.1 Persist working summaries, session summaries, episodic learner memories, and intervention outcomes.
- [ ] 2.2 Implement corrective and remedial interventions with why-now, evidence, alternatives, cooldowns, teacher policy, and feedback recording.
- [ ] 2.3 Keep semantic learner memory and strategy memory feature-flagged for the Stage 2 optimization change.

## 3. Validation

- [ ] 3.1 Add tests for tool authorization, prompt context composition, memory retrieval, intervention cooldowns, feedback persistence, and redaction of raw dialogue/answer data.
- [ ] 3.2 Validate with `rtk proxy openspec validate upgrade-konling-adaptive-agent-runtime --strict`.
