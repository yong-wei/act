## 1. Draft And Outbox

- [x] 1.1 Define LearningEvidenceDraft or equivalent staging contract for SimulationRun, Arena preview, and AgentToolRun sources.
- [x] 1.2 Define outbox event fields for correlation id, causation id, owner user, source run/tool, provenance, and privacy scope.
- [x] 1.3 Define dedupe keys for repeated run, tool, replay, and review processing.

## 2. Materialization

- [x] 2.1 Materialize deterministic simulation and Arena summaries into governed LearningFacts.
- [x] 2.2 Keep model-authored narratives as reviewable evidence or low-confidence rationale unless review policy approves them.
- [x] 2.3 Preserve preview/official/course/standalone/agent-assisted provenance in facts and summaries.

## 3. Consumers

- [x] 3.1 Update feature cache contract to rebuild from owner-scoped facts, drafts, and summaries.
- [x] 3.2 Update profile and recommendation rationale to include provenance, confidence, and source coverage.
- [x] 3.3 Update teacher insight contract for class-scoped simulation-agent summaries and drilldown redaction.

## 4. Validation

- [x] 4.1 Add tests for idempotent draft/fact creation and retry safety.
- [x] 4.2 Add tests for feature-cache deterministic rebuild without raw trace scans.
- [x] 4.3 Add tests for profile owner scope and teacher class scope.
- [x] 4.4 Run `rtk proxy openspec validate materialize-simulation-agent-evidence --strict`.
