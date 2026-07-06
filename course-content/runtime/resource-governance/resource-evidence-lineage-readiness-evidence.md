# Resource Evidence-Lineage Readiness Evidence

Artifact version: resource-evidence-lineage-readiness.v1
Source audit rows: 5291
Path-relevant rows: 4186
Evidence-producing rows: 3378
Evidence-lineage blockers: 9
Reviewed limitations: 3124
Ready rows: 1062

## Finding Counts

- missing-evidence-contract: 3133
- missing-evidence-instrumentation: 2169
- missing-human-review: 9

## Contract Field Gaps

- attemptKey: 2169
- clientEventIdPolicy: 2169
- confidencePolicy: 2169
- eventType: 2169
- learningFactMaterializationPolicy: 2169
- learningFactPolicy: 2169
- privacyScope: 973
- sourceLogId: 2169
- timestamps: 2169

## Follow-up Buckets

- complete-evidence-lineage-bindings: 3133

## Yang Fan Fixture Precondition

Blocked: true
Blocker count: 9
Scoped blocker count: 9
Global limitation count: 3124
Scope policy: yangfan-fixture-readiness-scope.v1
Reason: Canonical learner fixture generation remains blocked until fixture-owned evidence lineage gaps are resolved.

## Evidence Files

Source audit: course-content/runtime/resource-governance/resource-field-completion-audit.jsonl
Item JSONL: course-content/runtime/resource-governance/resource-evidence-lineage-readiness-items.jsonl

This evidence layer is privacy-minimized and records only lineage readiness, follow-up grouping, and fixture precondition blockers. Raw learner payloads and raw resource bodies are not included.
