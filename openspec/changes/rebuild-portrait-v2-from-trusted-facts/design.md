# Rebuild Portrait v2 from Trusted Facts: Design

## Context

Portrait v2 当前从 `LearningFact` 全量派生。历史客户端贡献、回填、fixture 和重算事实可能进入既有快照；仅阻断写入入口不能修复已经生成的画像，也不能阻止增量物化再次吸收旧事实。

本变更只建立可信事实到 Portrait v2 的物化与消费边界，不修改 `LearningFact` 表结构，不删除历史数据，不改变 HTTP API，不扩大路径优化算法。可信判定复用现有服务端证据锚点，不新增 `trusted` 字段，不做密码学证明。

## Goals / Non-Goals

**Goals:**

- 建立唯一版本化的 `trusted-learning-fact-policy.v1`。
- 在 Portrait v2 物化核心过滤不可信事实，使全量重建、增量更新和 legacy compatible snapshot 使用同一过滤。
- 通过版本提升触发历史重建，保留旧快照并通过 current pointer 切换。
- 无可信事实时发布 `NO_EVIDENCE`。
- 阻断 learner-state、推荐和路径规划对 legacy snapshot、feature cache、旧 `StudentCompetencySnapshot` 和旧 competency vector 的回退。

**Non-Goals:**

- 完整 fact lineage 审计。
- 密码学证明、签名或证据链存储扩展。
- 全局所有 Portrait 消费方治理。
- 修改 Beam Search、多策略路径优化算法。
- 修改 `LearningFact` schema 或删除历史证据。

## Decisions

### 1. Trusted Fact Filter 使用证据锚点而非新字段

新增 `src/lib/data-governance/trusted-learning-fact-filter.ts`，导出：

- `TRUSTED_LEARNING_FACT_POLICY_VERSION = 'trusted-learning-fact-policy.v1'`
- `isTrustedLearningFact(fact)` 判定函数
- `trustedLearningFactPolicy` 常量，供追溯和测试读取

判定规则：

- `sourceEventId` 为空或缺失：不可信。
- `sourceEventId` 以 `historical:`、`interaction-log:`、`yangfan-diagnostic-fixture:`、`backfill:`、`recompute:` 开头：不可信。
- `simulation-agent-evidence:` 或 `simulation-task-evidence:` 必须有非空 `sourceLogId`。
- producer/source 前缀不能单独作为充分条件；任何来源都必须满足证据锚点检查。
- 不读取 `trusted` 字段，不新增该字段。

`knowledgeRevisionRef` 是证据锚点的一部分，保留在 transition 中供追溯，但单凭该字段不能判定可信。

### 2. 过滤进入物化核心

`materializeIncrementalPortraitV2` 在 `learningFact.findMany` 之后、`planMissingLearningFactUpserts` 之前执行过滤。`materializeLegacyCompatibleSnapshot` 也复用同一过滤。

`PortraitLearningFactDelta` 增加 `sourceEventId`、`sourceLogId`、`knowledgeRevisionRef`。`cumulative-learner-state.ts` 的 `SerializedFact`、`correctedFact`、`serializeFact`、`cloneFact` 保留这些字段，确保 CORRECT 重建后的事实仍可被同一策略判定。

### 3. 版本提升与 current pointer 切换

提升 `PORTRAIT_V2_CALCULATION_VERSION` 与 `PORTRAIT_V2_MIGRATION_VERSION`，使现有 `requiresFullLearnerRebuild` 自动触发全量重建。保留旧快照和 `LearningFact`，不删除历史数据；当前指针由现有 `publishState` 原子更新。

### 4. 追溯元数据写入状态版本

`LearnerPortraitStateVersion` 增加：

- `trustedFactIds Json @default("[]")`
- `trustedFactPolicyVersion String @default("")`
- `trustedInputDigest String @default("")`

`publishState` 在发布 `NO_EVIDENCE` 和 SNAPSHOT 时写入这些字段。确定性定义为：相同可信事实集、策略版本、计算版本和 asOf 下，`trustedInputDigest` 与画像 payload digest 相同，重复执行不创建新的逻辑当前状态。

### 5. NO_EVIDENCE 是可消费的当前状态

只有非可信事实或没有可信事实时，发布 `NO_EVIDENCE` 并写明确 `availabilityReason`。该状态不是读取失败。旧兼容快照继续保留审计，但不得作为当前可信 Portrait 的个性化输入。

### 6. 消费侧 fail closed

- `adaptive-learner-state-service`：在 `resolveFencedAdaptivePortrait` 输出明确的 `primaryPortraitState` 与 `primaryPortraitAvailability`；`NO_EVIDENCE` 或无可信 current portrait 时不得构造 legacy vector 作为个性化主画像。
- `recommendation-engine`：可信 Portrait 不可用时不得读取 legacy snapshot、feature cache、旧 `StudentCompetencySnapshot` 或旧 competency vector 作为个性化推荐依据；允许默认或非个性化路径。
- `adaptive-learning-path-planner`：`NO_EVIDENCE` 或无可信 current portrait 时不得使用 legacy 能力向量或旧快照做个性化评分；返回默认或 starter path。

## Risks / Trade-offs

- [判定过严清空有效画像] -> 策略只排除明确不可信来源，带服务端日志锚点的正式来源继续可信。
- [消费侧 fallback 分散] -> 在 learner-state 状态契约处收口，推荐与规划器只消费显式可信 availability。
- [版本提升触发大范围重建] -> 保留旧快照、幂等 digest 和 current pointer，重建可重复执行。
- [schema 字段增加影响 fixture] -> 字段全部有默认值，现有读取路径继续兼容；直接相关测试补齐信任锚点。

## Migration Plan

1. 新增 trusted filter 与单测。
2. 扩展 fact transition 和状态版本字段，生成 Prisma migration。
3. 接入物化核心并提升版本常量。
4. 发布新的可信 Portrait 或 `NO_EVIDENCE` 状态。
5. 部署消费侧 fail closed。
6. 验证混合事实、增量一致性、NO_EVIDENCE 和重复重建确定性。

回滚时先恢复消费侧和物化版本常量；历史 `LearningFact` 与旧快照无需清理。新增状态版本字段为默认值字段，可按迁移回滚。

## Open Questions

无。可信来源清单、过滤位置、版本切换和消费边界已由 Issue 范围与 grill 决策确认。

## Testing Strategy

Change class: data-integrity
Seam status: internal-service
Public behavior: Portrait v2 的当前状态与路径规划/推荐输入边界
Public seam: `materializeIncrementalPortraitV2`、`resolveFencedAdaptivePortrait`、recommendation context、planner learner state
Existing seam reused: existing Portrait v2 materialization, cumulative learner state, learner-state service, recommendation context, planner input projection
AC coverage:

- AC-1: mixed trusted/non-trusted facts produce portrait only from trusted facts.
- AC-2: only non-trusted facts produce `NO_EVIDENCE`.
- AC-3: new trusted fact after rebuild does not re-admit old non-trusted facts.
- AC-4: `NO_EVIDENCE` blocks legacy fallback in path planning and recommendation.
- AC-5: repeated rebuild with same input yields identical trusted digest and payload digest.

Manual-only acceptance: none; all acceptance scenarios are covered by Vitest unit/integration tests plus `npm run typecheck`.

Rationale: the change is inside server-side governance and consumer boundaries; database migration is additive and testable without external services.
