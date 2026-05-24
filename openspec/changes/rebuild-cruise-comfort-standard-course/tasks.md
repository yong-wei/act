## 1. Standard Course Structure

- [ ] 1.1 Create a runtime manifest for cruise-comfort BOPPPS.
- [ ] 1.2 Rebuild student and teacher pages on the standard interactive course/session framework.
- [ ] 1.3 Preserve the public route `/interactive-learning/courses/cruise-comfort-boppps`.

## 2. Governance Adapters

- [ ] 2.1 Register a supported `CourseEvidenceSpec` for cruise-comfort.
- [ ] 2.2 Add cruise-comfort response-producing steps to submission gate inventory.
- [ ] 2.3 Route student submissions through `useManifestSubmissionController`.
- [ ] 2.4 Route teacher finalization through the unified finalization adapter.

## 3. Legacy Removal

- [ ] 3.1 Delete legacy cruise classroom code that is no longer used by the rebuilt route.
- [ ] 3.2 Remove route aliases or session snapshot mappings that classify cruise-comfort as legacy.
- [ ] 3.3 Update catalog, quick join, and tests to point at the rebuilt standard course.

## 4. Verification

- [ ] 4.1 Run focused cruise-comfort tests.
- [ ] 4.2 Run `npm run test:course-data-quality-gates`.
- [ ] 4.3 Run `npm run lint`.
- [ ] 4.4 Run `npm run build` if route wiring or assets changed.
