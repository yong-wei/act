# Resource Evidence-Lineage Readiness Evidence

Artifact version: resource-evidence-lineage-readiness.v1
Source audit rows: 5291
Path-relevant rows: 4186
Evidence-producing rows: 3378
Evidence-lineage blockers: 10
Reviewed limitations: 3124
Ready rows: 1062

## Finding Counts

- missing-evidence-contract: 3134
- missing-evidence-instrumentation: 2170
- missing-human-review: 10

## Contract Field Gaps

- attemptKey: 2170
- clientEventIdPolicy: 2170
- confidencePolicy: 2170
- eventType: 2170
- learningFactMaterializationPolicy: 2170
- learningFactPolicy: 2170
- privacyScope: 974
- sourceLogId: 2170
- timestamps: 2170

## Follow-up Buckets

- complete-evidence-lineage-bindings: 3134

## Yang Fan Fixture Precondition

Blocked: true
Blocker count: 10
Scoped blocker count: 10
Global limitation count: 3124
Scope policy: yangfan-fixture-readiness-scope.v1
Reason: Canonical learner fixture generation remains blocked until fixture-owned evidence lineage gaps are resolved.

## Evidence Files

Source audit: course-content/runtime/resource-governance/resource-field-completion-audit.jsonl
Item JSONL: course-content/runtime/resource-governance/resource-evidence-lineage-readiness-items.jsonl

This evidence layer is privacy-minimized and records only lineage readiness, follow-up grouping, and fixture precondition blockers. Raw learner payloads and raw resource bodies are not included.
