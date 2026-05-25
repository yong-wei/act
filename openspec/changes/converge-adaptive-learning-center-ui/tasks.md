## 1. Center Structure

- [ ] 1.1 Define overview, learner-state, mastery, path map, timeline, evidence, practice, and Konling panel contracts.
- [ ] 1.2 Define route compatibility for `/ai`, `/ai/copilot`, `/assessment/adaptive-practice`, and profile adaptive cards.
- [ ] 1.3 Define empty, fallback, low-confidence, stale, privacy-restricted, and partial-coverage states.

## 2. Integration Rules

- [ ] 2.1 Consume Learner State Service fields without accepting client profile hints as authority.
- [ ] 2.2 Consume rules+graph path map/timeline/evidence payloads without requiring Stage 2 optimization.
- [ ] 2.3 Display Konling context, intervention basis, cooldown, and feedback state where available.

## 3. Validation

- [ ] 3.1 Add tests for route compatibility, feature flags, path visualization rendering, and evidence-status display.
- [ ] 3.2 Validate with `rtk proxy openspec validate converge-adaptive-learning-center-ui --strict`.
