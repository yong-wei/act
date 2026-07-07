# Resource Evidence-Lineage Readiness Evidence

Artifact version: resource-evidence-lineage-readiness.v1
Source audit rows: 5291
Path-relevant rows: 4186
Evidence-producing rows: 3378
Evidence-lineage blockers: 23
Reviewed limitations: 3124
Ready rows: 1062

## Finding Counts

- missing-evidence-contract: 3147
- missing-evidence-instrumentation: 2183
- missing-human-review: 23

## Contract Field Gaps

- attemptKey: 2183
- clientEventIdPolicy: 2183
- confidencePolicy: 2183
- eventType: 2183
- learningFactMaterializationPolicy: 2183
- learningFactPolicy: 2183
- privacyScope: 987
- sourceLogId: 2183
- timestamps: 2183

## Follow-up Buckets

- complete-evidence-lineage-bindings: 3147

## Yang Fan Fixture Precondition

Blocked: true
Blocker count: 23
Scoped blocker count: 23
Global limitation count: 3124
Scope policy: yangfan-fixture-readiness-scope.v1
Reason: Canonical learner fixture generation remains blocked until fixture-owned evidence lineage gaps are resolved.

## Evidence Files

Source audit: course-content/runtime/resource-governance/resource-field-completion-audit.jsonl
Item JSONL: course-content/runtime/resource-governance/resource-evidence-lineage-readiness-items.jsonl

This evidence layer is privacy-minimized and records only lineage readiness, follow-up grouping, and fixture precondition blockers. Raw learner payloads and raw resource bodies are not included.
