# Resource Evidence-Lineage Readiness Evidence

Artifact version: resource-evidence-lineage-readiness.v1
Source audit rows: 5291
Path-relevant rows: 4186
Evidence-producing rows: 3378
Evidence-lineage blockers: 22
Reviewed limitations: 3109
Ready rows: 1077

## Finding Counts

- missing-evidence-contract: 3131
- missing-evidence-instrumentation: 2182
- missing-human-review: 22

## Contract Field Gaps

- attemptKey: 2182
- clientEventIdPolicy: 2182
- confidencePolicy: 2182
- eventType: 2182
- learningFactMaterializationPolicy: 2182
- learningFactPolicy: 2182
- privacyScope: 971
- sourceLogId: 2182
- timestamps: 2182

## Follow-up Buckets

- complete-evidence-lineage-bindings: 3131

## Yang Fan Fixture Precondition

Blocked: true
Blocker count: 22
Scoped blocker count: 22
Global limitation count: 3109
Scope policy: yangfan-fixture-readiness-scope.v1
Reason: Canonical learner fixture generation remains blocked until fixture-owned evidence lineage gaps are resolved.

## Evidence Files

Source audit: course-content/runtime/resource-governance/resource-field-completion-audit.jsonl
Item JSONL: course-content/runtime/resource-governance/resource-evidence-lineage-readiness-items.jsonl

This evidence layer is privacy-minimized and records only lineage readiness, follow-up grouping, and fixture precondition blockers. Raw learner payloads and raw resource bodies are not included.
