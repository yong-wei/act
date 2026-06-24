## 1. Demo Fixtures

- [x] 1.1 Define synthetic demo students, class, registered goals, learner-state slices, paths, diagnosis views, assignments, grading runs, prep packs, citations, and Konling sessions.
- [x] 1.2 Ensure fixtures are resettable, deterministic, and clearly synthetic.
- [x] 1.3 Include provider and feature-flag prerequisites without storing secrets.

## 2. Acceptance Checks

- [x] 2.1 Verify student overview, multi-path selection, resource execution strip, evidence citations, and Konling modes.
- [x] 2.2 Verify teacher report, individual consultation, grading workbench, student feedback, and fixture-backed prep-pack review evidence.
- [x] 2.3 Verify citation truthfulness, privacy redaction, unavailable-state handling, and no real student data.

## 3. Documentation

- [x] 3.1 Document demo storyline, setup/reset, expected routes, API examples, screenshots or browser checks, and metric interpretation.
- [x] 3.2 Document rollback, feature flags, provider setup, privacy, and acceptance limitations.

## 4. Verification

- [x] 4.1 Run demo acceptance scripts or route checks.
- [x] 4.2 Run `rtk openspec validate package-intelligent-teaching-assistant-demo --strict`.
