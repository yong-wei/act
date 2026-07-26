## 1. Unified answer persistence

- [x] 1.1 Extend the question-answer draft and immutable attempt schema for Markdown text, embedded image assets, ordered independent attachments, and answer revision.
- [x] 1.2 Add deterministic attachment ordering and stable embedded-position references without storing raw bytes in JSON or logs.
- [x] 1.3 Add order provenance that distinguishes explicit `student-arranged` order from deterministic `legacy-fallback` order.
- [x] 1.4 Add migration indexes and compatibility projections while preserving frozen publication fields, hashes, revision ids, and historical associations.

## 2. API and validation

- [x] 2.1 Update upload signing and finalization schemas to consume the unified response contract without active response-type checks, accept only the agreed formats, and return localized structured error metadata.
- [x] 2.2 Enforce the shared ten-asset limit across embedded images and independent attachments at signing, finalization, save, reorder, and submission.
- [x] 2.3 Implement revision-guarded atomic attachment reordering that rejects missing, duplicate, foreign, or stale asset lists.
- [x] 2.4 Update draft save and question submission to accept text, attachments, or both and to seal the complete ordered answer snapshot.
- [x] 2.5 Keep existing authentication, Origin/CSRF, authorization, integrity, idempotency, quota, and per-file size protections.

## 3. Legacy compatibility

- [x] 3.1 Make teacher authoring, student delivery, upload signing/finalization, and submission projections ignore legacy `TEXT`/`FILE` restrictions while retaining those values for audit.
- [x] 3.2 Accept new unified answers against legacy published revisions without rewriting their content hashes or snapshots.
- [x] 3.3 Add a dry-run migration that reports which historical attachment orders have explicit student provenance and which require deterministic fallback.
- [x] 3.4 Apply and persist stable fallback order plus provenance without rewriting old snapshots or attributing fallback order to the student.

## 4. Verification

- [x] 4.1 Add contract tests for text-only, attachment-only, mixed, empty, ten-asset, over-limit, duplicate-reference, and unsupported-format cases.
- [x] 4.2 Add concurrency tests for upload completion versus reorder/save and submission idempotency.
- [x] 4.3 Add legacy revision fixtures proving unified behavior and unchanged audit identities.
- [x] 4.4 Add repeated dry-run/apply tests proving identical historical inputs produce the same fallback order and provenance.
- [x] 4.5 Run affected unit/integration/data tests, Prisma migration validation, and typecheck.
