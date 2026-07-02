## Design

### Scope

The helper should be a read-only command under the project scripts surface. It should inspect the same source-of-record layers used by the application instead of relying on ad hoc SQL snippets:

- Prisma knowledge graph and teaching resource records.
- Runtime resource-governance artifacts.
- ResourceNode registry and runtime projection readiness.
- Graph Center resource coverage and KAQ node coverage.
- Source Pack / RAG citation corpus readiness where available.
- Source event and batch chain readiness, including InteractionLog, LearningEventBatch, EventDictionary, materialized LearningFact, snapshots, summaries, recommendations, and cache freshness where the schema supports them.
- Student evidence feature cache, historical LearningFact materialization, path execution evidence, adaptive assessment evidence, and canonical fixture-account readiness.

### Output Contract

The helper should emit:

- JSON summary for automation.
- Optional Markdown summary for agents and reviewers.
- Per-layer totals, missing-field counts, and blocker counts.
- Stable IDs for incomplete graph nodes, resource nodes, citation targets, PlanningUnits, and learner-state records.
- Recommended next work buckets without mutating data.
- Privacy-minimized identifiers: hashed or redacted emails/student numbers, no raw answer text, no raw event payloads, no raw resource content, and no hidden private evidence.

### Completeness Dimensions

The helper should keep dimensions separate:

- `graphCore`: active nodes, descriptions, tags, KAQ domain mapping, prerequisite edges, and target bindings.
- `resourceBinding`: linked resources, knowledge coverage, ability impact, quality target coverage, LearningGoal coverage, review status, and source hashes.
- `citationReadiness`: citation targets, citation addresses, retrieval chunks, verified citation refs, privacy scope, and route resolvers.
- `pathReadiness`: audited ResourceNodes, PlanningUnits, route targets, evidence contracts, path profile, readiness metadata, and human confirmation.
- `evidenceLineage`: source event ids, client event ids, attempt keys, source logs, batch processing state, EventDictionary mapping, materialization coverage, timestamps, dedupe policy, and attribution from raw source to derived LearningFact.
- `learnerFixtureReadiness`: canonical account identity, LearningFact count, KnowledgeProgress coverage, LearningPathExecution evidenceRefs, adaptive assessment state, snapshots, and StudentEvidenceFeatureCache source coverage.

### Blocking Policy

The helper should report three severities:

- `blocked`: prevents use in path planning, high-confidence citation, or test fixture generation.
- `partial`: usable only with limitations or citation-only behavior.
- `advisory`: should be completed but does not block the targeted flow.

### Yang Fan Probe

The helper should identify the canonical Yang Fan account by stable email/student number and report duplicate accounts separately. It must not delete or merge duplicate accounts; it only reports whether fixture generation is safe to run after resource data is complete.

The account report should mask direct identifiers in normal output. A privileged local debug mode may include direct ids only when explicitly requested and never include raw answer text, raw event payloads, or private memory content.
