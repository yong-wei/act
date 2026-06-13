## 1. Student Path Product Surface

- [x] 1.1 Add or update the student path center for control-correction path comparison.
- [x] 1.2 Show path style, policy family, deficits, resource mix, effort, evidence basis, limitations, and terminal validation strategy.
- [x] 1.3 Wire diagnosis next actions into path comparison.
- [x] 1.4 Persist selection, rejection, switch, and helpfulness evidence using existing path-choice mechanisms.

## 2. Path Execution and Validation

- [x] 2.1 Show checkpoint, deviation, intervention, and terminal validation timeline states.
- [x] 2.2 Add official versus preview validation labels for simulation and Arena evidence.
- [x] 2.3 Add tests proving selection history is visible and does not directly update mastery.

## 3. Teacher Prep-Pack Flow

- [x] 3.1 Add teacher entry from class diagnosis to prep-pack generation or review.
- [x] 3.2 Add prep-pack review UI for candidate rationale, evidence, insertion target, runtime diff, and lifecycle actions.
- [x] 3.3 Wire activation, rollback, archive, and impact evidence flows through existing CourseEnhancementPack functions.
- [x] 3.4 Add tests proving active overlays are scoped and do not mutate base runtime content.

## 4. Konling Context and Acceptance

- [x] 4.1 Provide path advisor context for path options, selection history, and terminal validation.
- [x] 4.2 Provide prep coauthor context while preserving forbidden publish actions.
- [x] 4.3 Verify student path and teacher prep-pack story against the competition baseline.
- [x] 4.4 Run `rtk openspec validate productize-learning-path-prep-pack --strict`.
