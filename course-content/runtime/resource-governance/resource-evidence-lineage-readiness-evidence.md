# Resource Evidence-Lineage Readiness Evidence

Artifact version: resource-evidence-lineage-readiness.v1
Source audit rows: 5291
Path-relevant rows: 4184
Evidence-producing rows: 3378
Evidence-lineage blockers: 22
Reviewed limitations: 3122
Ready rows: 1062

## Finding Counts

- missing-evidence-contract: 3144
- missing-evidence-instrumentation: 2180
- missing-human-review: 22

## Contract Field Gaps

- attemptKey: 2180
- clientEventIdPolicy: 2180
- confidencePolicy: 2180
- eventType: 2180
- learningFactMaterializationPolicy: 2180
- learningFactPolicy: 2180
- privacyScope: 986
- sourceLogId: 2180
- timestamps: 2180

## Follow-up Buckets

- complete-evidence-lineage-bindings: 3144

## Yang Fan Fixture Precondition

Blocked: true
Blocker count: 22
Scoped blocker count: 22
Global limitation count: 3122
Scope policy: yangfan-fixture-readiness-scope.v1
Reason: Canonical learner fixture generation remains blocked until fixture-owned evidence lineage gaps are resolved.

## Evidence Files

Source audit: course-content/runtime/resource-governance/resource-field-completion-audit.jsonl
Item JSONL: course-content/runtime/resource-governance/resource-evidence-lineage-readiness-items.jsonl

This evidence layer is privacy-minimized and records only lineage readiness, follow-up grouping, and fixture precondition blockers. Raw learner payloads and raw resource bodies are not included.
