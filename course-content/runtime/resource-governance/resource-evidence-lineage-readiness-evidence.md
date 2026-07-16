# Resource Evidence-Lineage Readiness Evidence

Artifact version: resource-evidence-lineage-readiness.v1
Source audit rows: 5419
Path-relevant rows: 3506
Evidence-producing rows: 3482
Evidence-lineage blockers: 71
Reviewed limitations: 1352
Ready rows: 2105

## Finding Counts

- missing-evidence-contract: 1423
- missing-evidence-instrumentation: 1423
- missing-human-review: 22

## Contract Field Gaps

- attemptKey: 1423
- clientEventIdPolicy: 1423
- confidencePolicy: 1423
- eventType: 1423
- learningFactMaterializationPolicy: 1423
- learningFactPolicy: 1423
- privacyScope: 22
- sourceLogId: 1423
- timestamps: 1423

## Follow-up Buckets

- complete-evidence-lineage-bindings: 1423

## Yang Fan Fixture Precondition

Blocked: true
Blocker count: 22
Scoped blocker count: 22
Global limitation count: 1401
Scope policy: yangfan-fixture-readiness-scope.v1
Reason: Canonical learner fixture generation remains blocked until fixture-owned evidence lineage gaps are resolved.

## Evidence Files

Source audit: course-content/runtime/resource-governance/resource-field-completion-audit.jsonl
Item JSONL: course-content/runtime/resource-governance/resource-evidence-lineage-readiness-items.jsonl

This evidence layer is privacy-minimized and records only lineage readiness, follow-up grouping, and fixture precondition blockers. Raw learner payloads and raw resource bodies are not included.
