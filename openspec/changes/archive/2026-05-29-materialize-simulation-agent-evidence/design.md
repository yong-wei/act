## Context

The earlier changes make tool calls auditable and simulation/Arena runs canonical. This change defines how those records become governed teaching evidence. It intentionally stages evidence before LearningFact so model-assisted or agent-produced conclusions cannot directly pollute learner profiles.

## Decisions

### Draft Before Fact

Simulation and agent outputs should enter a `LearningEvidenceDraft` or equivalent staging boundary before becoming LearningFact. Drafts should carry:

- owner user
- source run/tool references
- fact type
- compact metrics
- evidence references
- provenance
- confidence
- privacy scope
- dedupe key
- reviewer state

Automated materialization can approve deterministic low-risk facts, but model-authored narratives and teacher-visible feedback should remain reviewable.

### Outbox And Dedupe Are Required

Run completion, tool completion, replay verification, and teacher review should emit outbox events with correlation and causation ids. Reprocessing the same run or tool result must not duplicate drafts or LearningFacts.

### User Isolation Carries Through Evidence

The owner user from AgentSession, AgentToolRun, SimulationRun, and Arena preview must carry into drafts, LearningFacts, feature cache entries, and profile/recommendation outputs. Teacher aggregation is class-scoped and must not expose another class or raw private memory.

### Consumers Use Summaries And Feature Cache

Profile, recommendation, teacher insight, and data-center consumers should read governed facts, summaries, or feature-cache payloads. Raw high-frequency trace samples and raw memory content are audit/drilldown data, not normal personalization inputs.

## Risks

- If LLM narrative writes directly into LearningFact, profile confidence becomes unreliable.
- If dedupe keys are weak, retries can double-count competency contribution.
- If teacher summaries skip owner/class checks, simulation records and Konling memory can leak across users.

## Verification

- Materialization tests for draft creation, dedupe, replay, retry, and review transitions.
- Feature-cache tests proving deterministic rebuild from facts and summaries without raw trace scans.
- Profile/recommendation tests for provenance and confidence markers.
- Teacher insight tests for class-scope and raw trace/memory redaction.
- `rtk proxy openspec validate materialize-simulation-agent-evidence --strict`.
