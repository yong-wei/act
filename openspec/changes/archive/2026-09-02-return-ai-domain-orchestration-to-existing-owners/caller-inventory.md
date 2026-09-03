# C30 owner map 与 handoff 证据

绑定修订：claim branch `return-ai-domain-orchestration-to-existing-owners` 实现 HEAD（基于 `cfa14e7670`，C29 合并后 integration）。

## 1.1/1.2 AI 面跨域访问盘点（before → after）

AI production 面 = `src/app/api/ai/**`、`src/lib/ai/**`、`src/lib/konling-*.ts`、`src/features/ai/**`。

| 调用点 | before | after |
|---|---|---|
| `api/ai/konling-context` 画像摘要 | `prisma.studentProfileSummary.findUnique` | `createPrismaLearnerStateRuntime().learningRecord.readProfileSummary`（personalization owner port） |
| `api/ai/konling-context` 能力快照 | `prisma.studentCompetencySnapshot.findFirst` | `learningRecord.readLatestCompetencySnapshot`（同上；owner 排序含 id tie-break，行为超集） |
| `api/ai/konling-context` 教师/班级归属校验 | `prisma.class` + `prisma.studentProfile.findFirst`（route 授权语义） | **保留在 route**（R5：授权留在现有边界；studentProfile 成员校验是仓库惯例授权模式） |
| `konling-agent-runtime` path 写入/证据 | deep import `path-planning/control-correction-path-rounds` | `path-planning/public-api`（owner 加 re-export 声明边界） |
| `konling-agent-runtime` candidate graph 合同/策略 | deep import `knowledge/candidate-graph-{contracts,policy}` | `knowledge/public-api`（新建 owner 边界） |
| `konling-teaching-assistant-server-context` 自适应诊断 | deep import `assessment/adaptive-diagnosis-context` | `assessment/public-api`（owner 加 re-export） |
| `konling-teaching-assistant-server-context` 评分草稿合同 | deep import `teacher/document-rubric-grading-workbench` | `teacher/public-api`（新建 owner 边界） |
| `konling-teaching-assistant-server-context` 诊断 profile 版本 | deep import `personalization/diagnosis/control-correction-diagnosis-profile` | `personalization/diagnosis/public-api`（新建 owner 边界） |
| AI companion（features/ai）Arena 类型/种子 | `@/features/arena/types`、`arena/data/seed-challenges` | `@/features/arena/domain`（arena-module-boundary spec 的显式公共边界） |
| AI companion 干预类型 | `personalization/interventions/policy` | `interventions/public-api`（既有边界） |
| AI 自有会话表（konlingSession/agentSession/agentToolRun） | — | 保留（AI 域自有 store，非跨域） |

新建 owner 边界（3 个）：`src/features/knowledge/public-api.ts`、`src/features/teacher/public-api.ts`、`src/features/personalization/diagnosis/public-api.ts`——均为既有 owner 符号的 re-export 声明，不新增业务实现（Non-Goals：不以 AI 层 helper 代替 owner contract）。

## 1.3 负向授权证据

`ai-domain-orchestration-boundaries.test.ts` 断言：konling-context 的 `verifyTeacherStudentScope`（班级归属 + 教师所有权）先于任何 `readLearnerState`/画像读取；越权直接 403/404。伪造 userId/classId 无法扩大 scope（R3）。

## 3.1 依赖图契约（no-second-workspace / explicit boundary）

`src/lib/__tests__/ai-domain-orchestration-boundaries.test.ts`（4 tests）：
1. AI 面跨 `@/features/*` 只经 `public-api` 或 Arena `domain/client/server` 显式边界（AI 自域 features/ai 除外）；
2. AI route 不直读画像/能力快照 Prisma 模型，studentProfile 仅允许 findFirst 成员校验（禁 findMany/create/update）；
3. candidate-graph 与 control-correction-path-rounds 对 AI lib 不可 deep import；
4. forged scope 先拒绝后读取。

## 写入语义（R1/R4，未改变面）

AI 触发的业务写入全部经 owner 函数执行（persistLearningPathRound/recordPathChoiceEvidence/recordPathIntervention 由 personalization 持有；persistAdaptivePathCandidateBatch 同理），revision/idempotency/审计由 owner contract 保持；本 change 未改任何写入路径。

## 验证（3.3）

- 契约 4 tests 过；受影响域（konling runtime/diagnosis/path-advisor/ai/knowledge）1129 tests 1127 过——2 失败为 knowledge 视觉契约既有债（stash 基线复现，与本 diff 无关）。
- `typecheck` 0 错误；`lint` 0 warning；strict validate 通过。

## Rollback

恢复本提交的 import 映射与 konling-context 直读（caller mapping 级回滚）；三个新建 public-api 边界文件随之删除；不回滚 owner 实现、数据或审计。

## C33 handoff

- AI 面跨域边界已收敛为显式 public-api / Arena 边界 / learner-state port 三类，依赖图契约在 `ai-domain-orchestration-boundaries.test.ts` 持续守护。
- C33 可基于该契约扩展 owner read-model 合同（classroom 成员校验、learning-record read model 显式化）。
