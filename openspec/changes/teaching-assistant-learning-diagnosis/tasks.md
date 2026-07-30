## 1. Risk scanner background pipeline

- [x] 1.1 Implement the three current deterministic risk rules and exclude legacy audit-only risks.
- [x] 1.2 Implement create, update, resolve, and unchanged transitions for current flags.
- [x] 1.3 Add cursor-paged population scanning, queue scheduling, and an executable worker consumer.
- [x] 1.4 Add transition and pagination unit tests.

## 2. Konling teacher diagnosis mode

- [x] 2.1 Register the teacher-only `teacher-diagnosis` mode and its three tools.
- [x] 2.2 Bind every tool request to an active class owned by the authenticated teacher.
- [x] 2.3 Enforce target-student membership and return redacted evidence summaries with coverage, confidence, cutoff, and references.
- [x] 2.4 Add authorization and redaction tests.

## 3. Diagnosis report persistence

- [x] 3.1 Add governed class, creator, target, and evidence-cutoff fields to `DiagnosisReport`.
- [x] 3.2 Update the migration and Prisma relations.
- [x] 3.3 Implement teacher-authorized report write and read services and API routes.
- [x] 3.4 Reject raw or private evidence payloads and generate preparation links for knowledge-node findings.
- [x] 3.5 Add report authorization, validation, write, and read tests.

## 4. Verification

- [x] 4.1 Validate Prisma schema and migration shape.
- [x] 4.2 Pass targeted Vitest suites.
- [x] 4.3 Pass TypeScript typecheck for the affected dependency graph.
- [x] 4.4 Pass strict OpenSpec validation.
