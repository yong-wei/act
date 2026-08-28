# Characterization — migrate-personalization-recommendations-and-interventions

Captured on `migrate-personalization-recommendations-and-interventions` at `d522945da`（含已合入的 learner-state / control-correction plugin）。

本 change 不部署、不激活生产 selector，也不迁移生产历史事实。不要改冻结全局 `docs/architecture/deprecation-ledger.md` census。

## 1.1 Inventory

### Recommendation engine

| Item | Pre-move fact |
| --- | --- |
| Authority | `src/lib/data-governance/recommendation-engine.ts`（约 1714 行，直接 `import { prisma }`） |
| Public functions | `generateRecommendations(userId)`、`getRecommendationById`、`dismissRecommendation`（后者仅 `console.log`） |
| Re-exports | `getRecommendedScaffolding` / `getCompetencyLabel` / `getCompetencyLevel`（实现分别在 `risk-detector` / `competency-model`，生产调用者已直连那些模块） |
| Decision id | `` `${rule.id}-${Date.now()}` ``，同一决策重试会换 id |
| Prisma reads | `studentCompetencySnapshot`、`studentRiskFlag`、`learningFact`、`userProgress`；feature cache 经 `readStudentEvidenceFeatures(prisma, userId)` |
| Learner-state | `readPathPlannerLearnerStateForSubject(userId)`，无 goal；plugin citation 仅当 `goalSlices.controlCorrection` 存在 |
| Writes | 不写 LearningFact、不写 mastery、不写 EvidenceOutbox |
| Privacy | rationale 来自 feature cache / portrait / facts 的聚合字段；不把原始答案或 prompt 放进 Recommendation |

生产调用者：

- `src/app/api/student/recommendations/route.ts` — `generateRecommendations(session.user.id)`
- `src/lib/data-governance/profile-center.ts` — **仅类型**（`Recommendation*`）
- `src/app/(main)/profile/page.tsx` — **仅类型** `RecommendationRationale`

测试仍 mock `@/lib/data-governance/recommendation-engine` 的文件：`profile-route.test.ts`、`teacher-insights-evidence-governance.test.ts`（生产路由已不调用该引擎）。

### Companion intervention strategy

| Item | Pre-move fact |
| --- | --- |
| Authority | `src/features/ai/companion/intervention-engine.ts`（纯函数，无 Prisma） |
| Types | `InterventionType` = `failure-analysis` \| `constraint-hint` \| `guidance` \| `encouragement`（**不是**微辅导生命周期事件） |
| Functions | `shouldIntervene`、`generateIntervention` |
| Writes | 无 |

生产调用者：

- `src/app/api/ai/intervention/check/route.ts` — 直接 `shouldIntervene`
- `src/app/api/ai/intervention/generate/route.ts` — `createGovernedKonlingIntervention`（内部仍调 shouldIntervene/generateIntervention）
- `src/lib/konling-agent-runtime.ts` — 策略判定 + 写 `aIIntervention` / cooldown / memory；**不**在该函数 staging EvidenceOutbox
- `src/lib/konling-intervention-client-payload.ts`、`ai-companion-panel.tsx` — 类型

### Micro-tutoring evidence (Assessment adapter, not companion policy)

| Item | Pre-move fact |
| --- | --- |
| Outcomes | `micro-intervention-outcomes.ts`；事件白名单 `RESOURCE_USED` / `HINT_REQUESTED` / `COMPLETED` |
| Outbox stage | `enqueueMicroInterventionEvidenceProjection` → `EvidenceOutbox.upsert`，`eventType=micro-intervention-evidence`，`status=pending`，`dedupeKey=micro-intervention:pending:${interventionId}:${watermark}`，`correlationId=interventionId`，`causationId=watermark` |
| Materializer | `processPendingMicroInterventionEvidenceProjections` 写 LearningFact（`writeKnowledgeScopedLearningFacts`，`sourceEventId=micro-intervention:${evidenceId}`，`skipDuplicates`） |
| Limitations | 始终带 `not-terminal-mastery`；非独立验证信封 `skipProfileContribution: true` |
| Producer dual-path | events/validation **路由在 staging 后同步调用 processPending**（与 worker 唯一物化冲突） |
| Worker | `scripts/workers/data-governance-worker.ts` `processEventIngestionJob` 调用 processPending |
| Unused duplicate | `scheduleMicroInterventionEvidenceProjection` 会直接 `projectMicroInterventionOutcome`；仓库内无生产调用者 |

其他 EvidenceOutbox 生产者（Arena writeback、teacher assignment review、path rounds、Konling 仿真/工具证据、teacher-evidence-intervention-contract）**不是**本 change 的推荐/干预策略，保留原 owner。

### Direct LearningFact / mastery writes in this surface

- 推荐引擎：无。
- Companion `shouldIntervene`：无。
- Konling `createGovernedKonlingIntervention`：写 `aIIntervention`，不写 LearningFact。
- 微辅导 events/validation：outbox + **请求内** processPending（将收敛为只 staging）。
- Assessment 同步评分 fact：保留直写，不强制事件化。
- Arena 正式成绩：不改 evaluator。

## 1.3 Behaviors to preserve

| Behavior | Fixture |
| --- | --- |
| 推荐排序、理由、confidence、portrait 兼容规则 | `src/features/personalization/recommendations/__tests__/engine.test.ts`（自 `recommendation-engine.test.ts` 迁入） |
| 推荐响应字段 `id/type/title/description/reason/actionUrl/actionLabel/priority/tags/rationale` | student recommendations route 映射；characterization 测试锁定 |
| Companion Arena 指标约束与方法感知文案 | `src/features/personalization/interventions/__tests__/policy.test.ts` |
| generate 路由不在 handler 内直接 `shouldIntervene` | `src/app/__tests__/ai-intervention-generate-route-contract.test.ts` |
| 微辅导事件白名单与幂等冲突 | `micro-intervention-outcomes` / route tests |
| 独立验证才有 bounded profile weight，HINT/浏览不晋级 mastery | `micro-intervention-learning-evidence.test.ts` + 本 change characterization |
| `PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER` 标记 | 保留在迁入后的 `engine.ts` 规则附近 |

## 5.3 Verification

Targeted suites passed: recommendation engine/policy, intervention policy, Personalization boundary, Learning Record outbox port, micro-intervention evidence/outcomes/routes, AI intervention generate contract, plugin-registry, learner-state reducer, profile-route, teacher-insights, architecture-fitness, Konling intervention cases.

`rtk npm run typecheck` completed with zero `tsc-type-errors`. Printed `production-to-documentation` / `production-to-tooling` / `web-includes-*` codes are the existing architecture-graph baseline, not this diff.

`openspec validate migrate-personalization-recommendations-and-interventions --type change --strict` passed. `git diff --check` clean.

This change does not deploy or activate a production selector, and does not migrate historical LearningFact rows.

