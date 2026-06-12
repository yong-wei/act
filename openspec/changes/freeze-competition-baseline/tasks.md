## 1. Baseline Ledger

- [ ] 1.1 Create `docs/competition/xh-202620-capability-map.md` mapping competition requirements to implemented, partial, and planned platform capabilities.
- [ ] 1.2 Create a deterministic route ledger for the teacher, student, and administrator competition click path.
- [ ] 1.3 Record temporary placeholder, feature-flagged, and API-only surfaces so later changes can remove or upgrade them deliberately.

## 2. Demo Data Contract

- [ ] 2.1 Define demo teacher, administrator, and student accounts with stable identifiers and role boundaries.
- [ ] 2.2 Add or update deterministic seed/reset commands or APIs for the competition baseline, reusing existing intelligent teaching assistant demo-package records where possible.
- [ ] 2.3 Ensure seeded diagnosis, grading, path, Konling, prep-pack, overlay, and effect-report records carry explicit synthetic data-origin metadata.
- [ ] 2.4 Add an idempotency check proving repeated seed/reset does not duplicate records.

## 3. Acceptance

- [ ] 3.1 Add baseline acceptance checks for route reachability, role access, data-origin visibility, and effect-report payload availability.
- [ ] 3.2 Verify students use learner-record surfaces rather than Data Center.
- [ ] 3.3 Run `rtk openspec validate freeze-competition-baseline --strict`.
