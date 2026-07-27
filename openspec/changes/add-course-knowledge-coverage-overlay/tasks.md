## 1. Define course coverage authoring

- [x] 1.1 Define the Git-managed Overlay schema with course, Canonical ID, pinned Release, role, and authoring revision.
- [x] 1.2 Restrict roles to `formal_objective`, `necessary_prerequisite`, and `explicit_extension`.
- [x] 1.3 Add validation for missing objects, Release drift, duplicate roles, and unsupported values.

## 2. Build runtime projection

- [x] 2.1 Add Prisma models and migration for versioned CourseCoverage runtime projections and import receipts.
- [x] 2.2 Implement deterministic transactional import from reviewed authoring data without database-to-Git writeback.
- [x] 2.3 Add Repository queries that distinguish browsable authoritative objects from course-admitted objects.
- [x] 2.4 Keep resource matches and model suggestions as non-active candidates only.

## 3. Verify admission boundaries

- [x] 3.1 Add tests proving uncovered objects cannot enter recommendation, KAQ, path, assessment, or new-fact inputs.
- [x] 3.2 Add a minimal root-locus demonstration Overlay and verify complete Release browsing remains intact.
- [x] 3.3 Verify no teacher or administrator runtime mutation endpoint is introduced.
- [x] 3.4 Run targeted tests, typecheck, authoring validation, and strict OpenSpec validation.
