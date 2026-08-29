# Characterization

Captured on `migrate-learning-record-consumers` against `integration@af1e84736` (#1584 current projections).

## Consumer inventory

| Surface | Owner | Raw / legacy input | Scope | Replacement port | Tests |
| --- | --- | --- | --- | --- | --- |
| `GET /api/student/competency-snapshot` | student | current pointer via `readCurrentCumulativePortrait` | authenticated self | `readStudentEvidencePort` | `student-competency-snapshot-route.test.ts` |
| `GET /api/user/profile` portrait | student | current pointer; InteractionLog is activity feed | authenticated self | `readStudentEvidencePort` | `profile-route.test.ts` |
| `GET /api/teacher/classes/[classId]/insights` | teacher | class + member currents; Arena `LearningFact` stays Arena-owned | class teacher / admin | `readTeacherClassEvidencePort` | `teacher-attainment-delivery.test.ts` |
| `GET /api/teacher/classes/[classId]/heatmap` | teacher | class + member currents | class teacher / admin | `readTeacherClassEvidencePort` | `teacher-attainment-delivery.test.ts` |
| `GET /api/teacher/classes/.../students/.../insights` | teacher | member current + class current; LearningFact/session reports are drilldown | class membership | `readTeacherStudentEvidencePort` | `teacher-student-cumulative-insights.test.ts` |
| `resolveFencedAdaptivePortrait` | Personalization | current pointer | `userId` from `readLearnerState` | `readAuthorizedCumulativePortrait` | `learner-state-reducer.test.ts` |
| `resolveEvidenceCopilotContext` | Copilot | `readLearnerState` (portraitConsumer `student`) | authenticated user | unchanged resolver; portrait via Personalization port | `evidence-copilot-context.test.ts` |
| smart-prep class diagnosis options | teacher | class current | owned classes | `readTeacherClassEvidencePort` | existing smart-prep callers |
| `readGenerationClassContext` | teacher | class current | owned selected class | `readTeacherClassEvidencePort` | smart-lesson-plan tests |
| `GET /api/student/evidence` timeline | student | governed fact timeline | self | drilldown, not current-projection page | `evidence-timeline.test.ts` |
| admin / interactive `interactionLog` | audit / course runtime | InteractionLog | operator / session | **not** a Learning Record current read | retained |

## Output parity and status

- Qualified SNAPSHOT maps to `qualified` with coverage, freshness, confidence, `generatedAt` as provenance revision.
- `NO_EVIDENCE` / `no-eligible-evidence` is **known-zero** (`partial`), not unavailable.
- Pointer version mismatch is `conflict`; reconciliation/migration is `stale`; missing current is `unavailable`.
- Newer LearningFact `startedAt` after `evidenceAsOf` marks the student port `stale` without scanning InteractionLog.
- Teacher aggregates use independent learner count 5; per-student roster scores remain visible to the authorized teacher.

## Watermark / revision

Consumer envelopes bind `captureRevision` to portrait `generatedAt` and `stateWatermark` to `evidenceAsOf`. Digests are derived by `buildProjectionEnvelope`; they are not a second materializer.
