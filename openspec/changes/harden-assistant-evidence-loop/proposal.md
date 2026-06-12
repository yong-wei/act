## Why

The assistant loop can only be convincing if every diagnosis, recommendation, and Konling answer is backed by governed evidence that users can inspect. The current implementation has diagnosis snapshots, RAG citation verification, and Konling mode contracts, but the evidence chain is still too protocol-heavy and not consistently surfaced across the competition story.

## What Changes

- Expand control-correction diagnosis evidence mapping across document grading, adaptive answers, simulation or Arena summaries, and learning-path execution.
- Require role-projected diagnosis views to expose evidence drilldowns, limitations, confidence, and next-action links.
- Productize citation rendering as shared inspectable evidence components across diagnosis, grading feedback, path advice, and Konling answers.
- Add Konling mode readiness checks for diagnosis, path, grading, feedback, class summary, and prep-pack contexts.
- Add guarded fallback states when required context or citations are unavailable.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `control-correction-diagnosis-profile`: broadens report-ready evidence mapping and observation requirements for competition diagnosis.
- `role-based-learning-diagnosis`: strengthens student and teacher drilldown, limitation, and next-action requirements.
- `learning-evidence-rag-corpus`: turns citation verification payloads into shared product-visible citation surfaces and audit states.
- `konling-agent-runtime`: requires page-level mode readiness and citation-backed response behavior for assistant modes.

## Impact

- Affects diagnosis report builders, evidence mappers, citation UI or payload shaping, Konling server mode context loaders, AI chat guard metadata, route-level readiness badges, and tests for privacy-safe evidence exposure.
- Depends on `freeze-competition-baseline` for the scenario and route ledger.
- Does not implement document grading evaluator quality, path selection UI, prep-pack activation UI, or final visual screenshot evidence.
