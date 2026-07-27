## 1. Understanding routes

- [ ] 1.1 Add a versioned attachment-understanding route discriminator for binary Mathpix and direct Markdown/plain-text processing.
- [ ] 1.2 Enforce checksum, size, authorization, frozen attempt, and external-processing policy gates before reading or sending an asset.
- [ ] 1.3 Implement bounded direct-text reading for Markdown and plain text with encoding, length, and limitation metadata.
- [ ] 1.4 Route PDF, DOC, DOCX, PPTX, PNG, and JPEG semantic understanding exclusively through Mathpix and prevent local binary extraction from entering grading evidence.

## 2. Evidence assembly

- [ ] 2.1 Version the ordered AnswerEvidence source manifest with student text, embedded anchors, independent attachment order, hashes, states, and limitations.
- [ ] 2.2 Insert successful embedded-image results at their Markdown positions and explicit missing markers at failed positions.
- [ ] 2.3 Append independent attachment results and missing entries after text in the student's persisted order.
- [ ] 2.4 Treat prompt-like attachment content as untrusted answer data and preserve the no-tools evaluator boundary.

## 3. Missing-evidence grading gate

- [ ] 3.1 Produce `EVIDENCE_INCOMPLETE` drafts only when at least one gradable text or attachment segment remains.
- [ ] 3.2 Include safe omitted-attachment identities and names in draft limitations without exposing provider errors or content.
- [ ] 3.3 Require revision-bound teacher confirmation before approval, final score, feedback, or evidence writeback.
- [ ] 3.4 Keep no-evidence answers blocked for AI grading while retaining original assets for authorized manual review.

## 4. Verification

- [ ] 4.1 Add routing tests for every allowed format, policy denial, retry exhaustion, and proof that binary local fallback cannot feed the evaluator.
- [ ] 4.2 Add ordered-assembly tests for text, embedded images, multiple attachments, mixed success, and later attempts.
- [ ] 4.3 Add authorization, policy, retention, audit-redaction, and teacher-confirmation integration tests.
- [ ] 4.4 Add a dry-run migration report covering approved history and every unapproved local-binary conversion, evidence, run, batch item, and queue job.
- [ ] 4.5 Apply idempotent legacy-ineligible/blocked transitions, preserve approved history, clear new evaluator/writeback readiness, and stop active queue consumption.
- [ ] 4.6 Verify no local binary adapter result enters the new assignment evaluator, batch, approval, or writeback chain while non-assignment document grading remains unchanged.
- [ ] 4.7 Document the assignment-response Mathpix-only exception and non-assignment boundary in `docs/ProjectDescription.md`.
- [ ] 4.8 Run affected unit/integration/data-governance tests, typecheck, migration dry-run/apply verification, and worker-path verification.
