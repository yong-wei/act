---
change_id: productionize-math-document-grading-pipeline
claim_branch: productionize-math-document-grading-pipeline
series: assignment-grading-workflow
coupling_group: assignment-grading-workflow
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - integrate-mainline-assignment-mission-center
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/productionize-math-document-grading-pipeline
risk: high
area: assignment-grading
---

## Goal

Productionize text and mathematical-document grading as an asynchronous, privacy-governed, anchor-preserving pipeline with normalized AnswerEvidence, Mathpix/local conversion, and schema-validated AI rubric drafts per assignment question.

## Scope

- Upstream immutable object-asset consumption plus AnswerEvidence, conversions, blocks/anchors, batches, grading runs, criterion assessments, and annotations.
- Text-native evidence, Mathpix routing, local fallback, explicit precision, retries/reruns, lifecycle policy, and telemetry.
- Provider-backed AI rubric evaluation for one frozen question answer at a time.
- Question-scoped batch grading with item-level isolation.

## Out of Scope

- Whole-assignment document segmentation.
- Automatic student-visible scores or evidence writeback.
- Teacher review UI and reviewed derivative generation.
- Mutation of original student files.

## Acceptance Checklist

- [ ] AC-1: Submitted text and document answers become immutable, authorized AnswerEvidence through durable asynchronous jobs that consume the upstream object-store contract. Owner: independent reviewer.
  Evidence: text/document evidence, queue persistence, historical/purpose authorization, retry/rerun, lifecycle, and idempotency tests.
- [ ] AC-2: Text-native and Mathpix/local document paths preserve canonical Markdown, rendered evidence where applicable, honest page/block/span/bbox precision, versions, warnings, and fallback states. Owner: independent reviewer.
  Evidence: text adapter tests, document adapter tests, and T1-1 formula/image fixture review.
- [ ] AC-3: Production AI grading uses one frozen question, answer, rubric, and evidence set and rejects malformed or unsupported output. Owner: independent reviewer.
  Evidence: provider-adapter and schema-validation tests covering scores, criteria, anchors, safety, and limitations.
- [ ] AC-4: Question-scoped batch grading is observable, resumable, deduplicated, and failure-isolated. Owner: independent reviewer.
  Evidence: batch progress, failure, retry, concurrency, and rerun tests.
- [ ] AC-5: Failure-closed provider/lifecycle policy and mutation security prevent unauthorized access, unsafe logs, credential exposure, prompt injection, indefinite retention, and automatic feedback/evidence publication. Owner: independent reviewer.
  Evidence: authorization, CSRF/schema/quota, logging/redaction, provider-policy, deletion/hold/GC, prompt-injection, draft-visibility, OpenSpec, Prisma, and typecheck gates.

## Tasks

- [ ] Task 1: Implement durable AnswerEvidence, conversion, anchor, batch, run, criterion, annotation, job, rerun, policy, tombstone, and retention records.
  Covers: AC-1, AC-4, AC-5
  Acceptance: Every evidence/job/artifact is versioned, queryable, authorized, retryable, lifecycle-governed, and idempotent; reruns never overwrite history.
  Evidence: migration diff plus persistence, dedupe/rerun, deletion/hold/GC, recovery, referential, and authorization tests.
  Reviewer Check: Confirm answer/source bytes are not stored in generic JSON, object storage is consumed from the previous change, and item failures cannot corrupt sibling jobs.
- [ ] Task 2: Implement text-native evidence plus DOCX/PDF/image conversion, Mathpix routing, local fallback, and precision metadata.
  Covers: AC-1, AC-2, AC-5
  Acceptance: Text answers enter grading without conversion; formula/image work retains usable rendered evidence and all anchors remain honest.
  Evidence: text/document adapter fixtures, provider-policy blocked/failure paths, safe audit records, and T1-1 sample evidence.
  Reviewer Check: Confirm both text and document submissions reach grading, provider credentials/content are absent from logs, and coarse anchors remain visibly coarse.
- [ ] Task 3: Implement provider-backed rubric evaluation and strict result validation.
  Covers: AC-3, AC-5
  Acceptance: Production runs use the configured AI provider only under failure-closed policy, remain question-scoped/no-tool, and reject invalid criteria, totals, anchors, injected instructions, or unsafe output.
  Evidence: evaluator, provider-policy, prompt-injection, mutation-security tests and proof that deterministic evaluation is fixture-only.
  Reviewer Check: Confirm a valid machine result remains a non-authoritative draft awaiting teacher review and missing provider policy sends no data.
- [ ] Task 4: Implement question-scoped batch orchestration and operations visibility.
  Covers: AC-4
  Acceptance: Batch versions are frozen, progress is durable, failures are isolated, and retry/rerun identity and reason are explicit.
  Evidence: worker, load, cancellation, retry, same/new-version rerun, dedupe, and outlier-status tests.
  Reviewer Check: Confirm batch scope cannot mix question/rubric revisions or leak answers across classes.
- [ ] Task 5: Run and record security, privacy, and project validation gates.
  Covers: AC-5
  Acceptance: OpenSpec, Prisma, TypeScript, targeted pipeline, mutation security, lifecycle, authorization, and privacy checks pass.
  Evidence: command outputs, retention/deletion matrix, and review evidence in the implementation handoff or PR.
  Reviewer Check: Independently inspect provider policy, redaction, restrictive relations, deletion/hold behavior, upstream signed access, and draft visibility before approving AC-5.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
