## 1. Define the task-aligned entry projection

- [x] 1.1 Add red tests for neutral, portfolio-reflection, evidence available/missing/unavailable and unsupported context states.
- [x] 1.2 Implement a student-safe entry presentation model for welcome copy, capabilities, suggestions, placeholder, limitations and adjacent actions.
- [x] 1.3 Ensure the model consumes only registered task contracts and authorized evidence projections, never arbitrary URL text as learning fact or capability.

## 2. Replace the fixed maritime default

- [x] 2.1 Replace the default ship, PID, Nomoto, CCS and track-error welcome content with the neutral no-task state.
- [x] 2.2 Preserve and align portfolio-reflection and Evidence Copilot task-specific suggestions and explicit boundaries.
- [x] 2.3 Ensure generic suggested questions do not request simulation state or unavailable tools, and each adjacent action reaches a real learning flow.

## 3. Verify the student experience

- [x] 3.1 Add component tests proving fixed maritime canary text is absent from neutral mode and task-specific content appears only in its registered state.
- [x] 3.2 Add Playwright journeys that click representative suggestions and actions for neutral, reflection, evidence available and evidence-limited states.
- [x] 3.3 Capture revision-bound 1440px and 320px evidence for the required states, including keyboard focus, text fit and no horizontal overflow.
- [x] 3.4 Run focused tests, full TypeScript checking, strict change and repository OpenSpec validation, Commercial UI governance and `git diff --check` on the final revision.
