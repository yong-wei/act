## 1. Demo Fixtures

- [ ] 1.1 Define synthetic demo students, class, registered goals, learner-state slices, paths, diagnosis views, assignments, grading runs, prep packs, citations, and Konling sessions.
- [ ] 1.2 Ensure fixtures are resettable, deterministic, and clearly synthetic.
- [ ] 1.3 Include provider and feature-flag prerequisites without storing secrets.

## 2. Acceptance Checks

- [ ] 2.1 Verify student overview, multi-path selection, resource execution strip, evidence citations, and Konling modes.
- [ ] 2.2 Verify teacher report, individual consultation, grading workbench, student feedback, and prep-pack review.
- [ ] 2.3 Verify citation truthfulness, privacy redaction, unavailable-state handling, and no real student data.

## 3. Documentation

- [ ] 3.1 Document demo storyline, setup/reset, expected routes, API examples, screenshots or browser checks, and metric interpretation.
- [ ] 3.2 Document rollback, feature flags, provider setup, privacy, and acceptance limitations.

## 4. Verification

- [ ] 4.1 Run demo acceptance scripts or route checks.
- [ ] 4.2 Run `rtk openspec validate package-intelligent-teaching-assistant-demo --strict`.
