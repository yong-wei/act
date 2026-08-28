# Characterization — reduce-personalization-learner-state

Captured on `reduce-personalization-learner-state` at `d45312070` (integration includes #1671 Assessment public API).

## 1.1 Dependency gate

| Input | Status | Evidence |
| --- | --- | --- |
| `cutover-path-owned-assessment-attempts` | archived 2026-08-28, merged #1671 | `openspec/changes/archive/2026-08-28-cutover-path-owned-assessment-attempts/`；`src/features/assessment/public-api.ts` |
| Assessment read projection | `readAbilityReport` / `readDiagnostic` / `readAttemptContext` | durable Prisma via `createPrismaAssessmentRuntime`；mastery rows 仍被 learner-state 直接 `adaptiveMasteryUpdate.findMany` |
| Learning Record evidence | `LearningFact` + portrait/snapshot/feature-cache | `readEligibleLearnerStateFacts` / `readAdaptiveMasteryLearningFacts` 仍在旧 service 内 |
| `establish-modular-monolith-refactor-charter` | archived 2026-08-26 | `openspec/changes/archive/2026-08-26-establish-modular-monolith-refactor-charter/` |
| `enforce-modular-domain-dependency-contracts` | archived 2026-08-26 | `openspec/changes/archive/2026-08-26-enforce-modular-domain-dependency-contracts/` |

本 change 不改 LearningFact schema、portrait v2 算法或 BKT。

## 1.2 Current I/O of `readAdaptiveLearnerState`

Entry: `src/lib/data-governance/adaptive-learner-state-service.ts`.

Reads (Prisma / caches, parallel then sequential):

- `studentEvidenceFeatureCache` via `readStudentEvidenceFeatures`
- `studentCompetencySnapshot.findFirst`
- `studentProfileSummary.findUnique`
- eligible `LearningFact` rows
- `adaptiveMasteryUpdate.findMany` (take 200)
- `adaptiveAssessmentAbilityEstimate.findFirst`
- unresolved `studentRiskFlag`
- `learningPath.findMany` (recent 10 + control-correction active/fallback)
- control-correction `LearningFact` / `arenaSubmission` / `agentToolRun` when goal is `control-correction`
- fenced cumulative portrait or `resolvePrimaryPortraitV2`

Computes without further I/O after portrait resolve: competency vector, knowledge mastery, evidence summary, role-filtered mastery traceability, secondary dimensions, missing-evidence list, goal slices.

Public functions:

| Export | Role |
| --- | --- |
| `readAdaptiveLearnerState(db, input)` | student/teacher/admin/system projection；`db` 由调用方注入 |
| `readPathPlannerLearnerState(db, userId, input)` | 同 reducer，强制 `role: 'system'`、`portraitConsumer: 'planner'` |
| `isAdaptiveLearnerStateServiceEnabled(env)` | `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED` |
| types / field contracts / `CONTROL_CORRECTION_*` / `projectLearnerStateFactIdentit*` | 被 graph/KAQ/Konling 当合同导入 |

`clientHints` 在 `AdaptiveLearnerStateInput` 上存在，不得成为 mastery 权威。

## 1.3 Current behaviors to preserve (parity fixtures)

Existing tests already encode these; new reducer must match:

| Behavior | Fixture location |
| --- | --- |
| portrait v2 fence / UNAVAILABLE vs SNAPSHOT vs NO_EVIDENCE | `src/lib/data-governance/__tests__/portrait-v2-model.test.ts` |
| mastery writeback, role privacy, no-evidence, stale, path slices | `src/lib/data-governance/__tests__/adaptive-learner-state-service.test.ts` |
| route flag off / subject authorization | `src/lib/data-governance/__tests__/adaptive-learner-state-route.test.ts` |
| history revision / fact identity projection | `projectLearnerStateFactIdentities` tests in the service suite |

`readPathPlannerLearnerState` is not a second calculator; it only fixes role/consumer then calls `readAdaptiveLearnerState`.
