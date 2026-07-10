## 1. Durable Pipeline Records

- [ ] 1.1 Add Prisma models, enums, indexes, restrictive referential actions, policy versions, tombstones, retention fields, and migration for AnswerEvidence, conversions, blocks/anchors, grading batches, runs, criterion assessments, annotations, and job states.
- [ ] 1.2 Consume `SubmissionObjectStore` and add current/frozen/purpose authorization plus pseudonymous audit and safe logging contracts for evidence, conversion, grading, and artifacts.
- [ ] 1.3 Add deterministic dedupe keys and explicit rerun identities/reasons for evidence, conversion, batch, run, retry, and provider-version boundaries.

## 2. Mathematical Document Conversion

- [ ] 2.1 Implement asynchronous conversion job orchestration with progress, cancellation, retry, and failure isolation.
- [ ] 2.2 Implement text-native AnswerEvidence plus DOCX render/OOXML extraction, PDF/image handling, canonical Markdown, and explicit bbox/span/block/page precision mapping.
- [ ] 2.3 Implement server-side Mathpix adapter and routing using rotatable secrets and the shared failure-closed provider policy for purpose, data, region/agreement, no-training, retention, deletion, rate, and disable controls.
- [ ] 2.4 Implement governed MarkItDown/local fallback, converter warnings, blocked states, and artifact/version persistence.

## 3. AI-Assisted Rubric Grading

- [ ] 3.1 Implement a provider-runtime grading adapter that receives one frozen question, answer, rubric, text-native or converted evidence, and limitations under the shared provider policy.
- [ ] 3.2 Implement strict output validation for criterion ids, scores, levels, rationale, confidence, anchors, annotations, limitations, and overall comment.
- [ ] 3.3 Restrict the deterministic evaluator to explicit fixtures/tests and make provider-backed evaluation the production path.
- [ ] 3.4 Implement question-scoped class batch grading with frozen versions, item progress, outlier/failure visibility, retry, and deduplication.
- [ ] 3.5 Add student-content prompt-injection isolation, no-tool/no-retrieval enforcement, and protected mutation guards for CSRF/Origin, schemas, bounds, authorization, idempotency, and quotas.

## 4. Verification And Operations

- [ ] 4.1 Add adapter tests for text-native evidence, Mathpix success/failure/policy-block behavior, local fallback, formula/image documents, and honest anchor precision.
- [ ] 4.2 Add evaluator tests for malformed output, unknown criteria/anchors, score overflow, missing evidence, prompt injection, privacy redaction, same-idempotency replay, explicit same/new-version reruns, and no automatic approval/writeback.
- [ ] 4.3 Validate the supplied T1-1 DOCX through a privacy-safe fixture workflow and verify formulas, rendered pages, hand-drawn evidence, Markdown, and anchor limitations.
- [ ] 4.4 Add batch load, mutation-security, idempotency, historical/purpose authorization, retention/deletion/hold/GC, referential action, metrics, and worker recovery tests.
- [ ] 4.5 Run Prisma validation/generation, targeted tests, `rtk npm run typecheck`, and `rtk openspec validate productionize-math-document-grading-pipeline --strict`.
