## 1. Persistence and projection contracts

- [x] 1.1 Add Prisma artifact, export-event, and disposition-event models plus a PostgreSQL migration with restrictive relations and stable uniqueness constraints.
- [x] 1.2 Implement canonical teacher and student-safe projections, content identities, evidence summaries, and role-safe omission tests.
- [x] 1.3 Implement authorized resource/action destination resolution without creating teaching objects.

## 2. PDF and audit services

- [x] 2.1 Implement deterministic Chinese-capable A4 PDF rendering with version footers, content and artifact hashing, and bounded pagination.
- [x] 2.2 Implement concurrency-safe artifact creation/reuse and append-only successful export events.
- [x] 2.3 Implement idempotent disposition writes and latest-state/history reads while proving diagnosis and risk records remain unchanged.

## 3. Authorized routes and delivery surfaces

- [x] 3.1 Add teacher detail, print, PDF, action-destination, and disposition routes with class-owner authorization and recoverable errors.
- [x] 3.2 Add student self-service page/PDF routes and teacher preview using the same student-safe audience projection.
- [x] 3.3 Add responsive teacher detail/print and student-safe UI, then connect report-history delivery and disposition entry points.

## 4. Verification and evidence

- [x] 4.1 Add focused projection, PDF, persistence, authorization, privacy, idempotency, and migration tests.
- [ ] 4.2 Capture 1440px and 320px browser evidence for teacher, student-safe, export failure, and disposition states with a source-bound manifest.
- [ ] 4.3 Pass Prisma validation/generation, affected tests, typecheck, ESLint, OpenSpec strict validation, and commit/push verification.
