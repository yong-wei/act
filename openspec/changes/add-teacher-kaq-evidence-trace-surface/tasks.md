## Tasks

- [ ] 1. Define the teacher K/A/Q evidence trace payload and route contract.
  - Include class scope, optional student scope, graph node selection, associated SAR evidence, resource gaps, candidates, and limitations.

- [ ] 2. Implement the teacher evidence trace surface.
  - Add the route, server-side scope checks, data adapter, and teacher UI.

- [ ] 3. Add authorization, redaction, and degraded-state tests.
  - Cover authorized teacher, unauthorized class, cross-student/cross-class rejection, audit-only redaction, and missing SAR data.

- [ ] 4. Validate the change.
  - Run `rtk openspec validate add-teacher-kaq-evidence-trace-surface --strict`.
  - Run targeted teacher evidence trace tests and browser/DOM checks if the route changes UI.
