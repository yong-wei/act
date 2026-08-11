# P0-02 可信 Portrait v2 重建：上下文

## 变更背景

Issue #1306 要求建立可信 LearningFact 到 Portrait v2 的可信链路，并阻断非可信画像进入路径规划。当前 Portrait v2 物化器按 `userId` 读取全部 LearningFact，历史客户端贡献、历史回填和诊断 fixture 都可能被重新纳入画像。仅阻断后续入口不能修复已有快照和旧画像继续进入推荐的问题。

本变更不修改 LearningFact 表结构，不删除历史数据，不新增 `trusted` 字段，也不做密码学证明。可信判定复用现有服务端证据锚点，并以版本化策略进入全量重建、增量更新和消费侧校验。

## 当前事实来源与生产链路

LearningFact 由受控 sink inventory 分类。与画像相关的来源包括：

- `core-event-materialization` 与 `data-governance-worker-event-ingestion`：从 LearningEvent 派生，`sourceEventId = event.eventId`，正式写入通过 fixed-identity adapter 附带当前 `knowledgeRevisionRef`。
- `arena-official-writeback`：`sourceEventId = arena-official:...`。
- `control-correction-path-rounds`：`sourceEventId = control-correction-path:...` 或 `learning-path:...`。
- `document-rubric-grading-workbench` 与 `document-grading-approve-route`：`sourceEventId = grading:...`、`document-rubric-grading:...` 或 `adaptive-assessment:document-rubric-grading:...`。
- `simulation-agent-evidence`：`sourceEventId = simulation-agent-evidence:...`，并带 `sourceLogId = SimulationRun:...` 或 `AgentToolRun:...`。
- `simulation-task-learning-fact`：`sourceEventId = simulation-task-evidence:v2:<sha256>`，属于非 knowledge-scoped runtime，但若带服务端 `sourceLogId`，仍可作为可信运行证据。

应排除的来源包括：

- `historical-evidence-materialization`、`course-evidence-backfill`、`interactive-evidence-scoring-recompute`、事件批回填、交互日志回填和迁移脚本，其 `sourceEventId` 通常以 `historical:`、`interaction-log:` 或回填特征开头。
- `yangfan-diagnostic-fixture`，以 `yangfan-diagnostic-fixture:` 开头。
- 客户端自行声称的 `sourceLogId`。生产事件入口会剥离 payload 中的非可信 `sourceLogId`，只保留服务端持久化后的 InteractionLog id。

## 当前画像物化链路

`materializeIncrementalPortraitV2` 是核心入口：

1. `learningFact.findMany({ where: { userId } })` 读取全部事实，当前 select 未携带 source 字段。
2. `planMissingLearningFactUpserts` 将新事实写入 `LearnerFactTransition`。
3. `reduceLearnerFactTransitions` 通过 UPSERT/CORRECT/REVOKE 生成 active facts。
4. `mapLearningFactsToPortraitEvidence` 将 active facts 映射为画像证据。
5. 无画像证据时发布 `NO_EVIDENCE` 状态；有证据时发布 SNAPSHOT。

另有 `materializeLegacyCompatibleSnapshot`，在未启用 cumulative state 数据库模型时仍可能写兼容快照，因此也必须只接收可信事实。

## 当前消费链路

推荐引擎当前在无权威 Portrait 时仍可能回退到：

- legacy learner state 向量
- feature cache 向量
- 旧 `StudentCompetencySnapshot.vector`

路径规划通过 `adaptive-learner-state-service` 读取 learner state，当前 NO_EVIDENCE 或缺失状态仍可能被包装为兼容向量，进而允许基于非可信能力画像生成个性化推荐。

## 目标与非目标

目标：

- 建立唯一版本化 Trusted Fact Filter。
- 过滤进入 Portrait v2 物化核心，全量重建与增量更新共用。
- 保留旧快照与历史事实，通过 current pointer 和计算版本切换当前 Portrait。
- 无可信事实时生成明确 `NO_EVIDENCE`。
- 阻断路径规划对 legacy snapshot、feature cache、旧 StudentCompetencySnapshot、旧 competency vector 的 fallback。

非目标：

- 完整 fact lineage 审计。
- 密码学证明或证据签名。
- 全局所有 Portrait 消费方治理。
- 路径优化算法、Beam Search 或多策略路径逻辑改动。
- LearningFact 表结构或历史数据删除。

## 主要风险

- 判定过严会清空当前有效画像；判定过松会继续吸收污染事实。
- 消费侧 fallback 分散，需在同一状态契约处收口。
- 版本提升触发全量重建，必须保证确定性并可重复执行。

## PR review 修订记录

PR #1334 首轮 review 提出两项问题，本轮已按问题边界整改：

1. P1：`trusted-learning-fact-filter` 从黑名单改为正向 admission。受控 producer 前缀和手动补充的 simulation task evidence 都要求非空 `sourceLogId`；未知带冒号前缀默认拒绝；无前缀事件仅作为 core materialization 契约，在服务端日志锚点存在时接受；嵌套路径中的历史、交互日志、fixture、backfill、recompute 标记仍拒绝。
2. P2：`recommendation-engine` 不再因缺少可信 Portrait 全局清空结果，仅跳过依赖向量/画像证据的规则，保留风险、学习历史和 context-only 推荐。

本轮验证已通过 `trusted-learning-fact-filter`、`recommendation-engine`、`adaptive-learner-state-service`、`adaptive-learning-path-planner` 四个 Vitest 文件，随后执行 `npm run typecheck`。

PR #1334 第二轮人工 review 针对 head `bb07a5750` 确认 GitHub Codex connector 已在 Reviewed commit `77cd568c9b` 清场，未发现重大问题；同一代码 head 不重复请求。随后写入的补充门禁结果如下：

- `openspec validate rebuild-portrait-v2-from-trusted-facts --type change --strict` 通过。
- `prisma validate` 通过。
- `prisma generate` 通过。
- 相关 Vitest 与 `npm run typecheck` 通过。
- 真实 PostgreSQL migration smoke 未执行：当前环境无可用 PostgreSQL/pg_config，也未提供可连接的真实实例，因此该项保持未勾选。
