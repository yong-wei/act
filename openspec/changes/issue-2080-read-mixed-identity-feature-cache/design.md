# Design: issue-2080-read-mixed-identity-feature-cache

## Context

特征缓存写入侧（`buildStudentEvidenceFeaturePayload`）在证据跨版本时追加 `mixed-knowledge-identity` 与 `partial` 标记（`student-evidence-feature-cache.ts:553-560`），该数组经 `buildAdaptiveLearnerStateFeature` 进入 `features.adaptiveLearnerState.confidence.markers`（`:1601`）。读取侧 `hasAdaptiveLearnerStateFeatureSchema` 要求 `hasStatusMarkersSchema(confidence.markers)`（`:2267`），而白名单（`:2423-2433`）仅含 `stale | partial | low-confidence | missing-source`。Git 考古确认：`f24126fa73`（#1153）引入写入侧标记时未同步扩展该白名单。

实证（真实函数 round-trip）：6 条合格事实（3 LEGACY_UNVERSIONED + 3 CANONICAL）写入后读取 → `state: 'stale'`；单版本对照组 → `ready`。

受损消费链：learner-state 服务（`internal.ts:1503-1504`、`:2144`）与画像中心（`profile-center.ts:472-474`）；推荐引擎层（`engine.ts:969-976`）有独立防御，不依赖本次修复。

## Goals / Non-Goals

**Goals:**

- 合法 `mixed-knowledge-identity` 标记通过读取校验，缓存 round-trip 后 `readState=ready` 且风险标记完整保留。
- 画像状态面透传混合身份标记与 `singleVersionComparable=false` 的可比性限制。
- 未知标记值、结构损坏、真实过期继续 fail-closed 为 `stale`。
- 四类 round-trip 回归测试锁定行为。

**Non-Goals:**

- 不改变写入侧标记的生成条件与语义。
- 不改变推荐引擎对混合版本证据的 fail-closed 策略。
- 不重构标记枚举为单一真源（可选后续，不阻断）。
- 不做数据库 schema 迁移（诊断数据已在 `features` JSON 列内）。

## Decisions

1. **最小修复点是读取白名单**：在 `hasStatusMarkersSchema` 的允许集合中加入 `mixed-knowledge-identity`。该标记语义在写入侧类型注释（`:72-87`）中已明确定义为诊断标记而非结构状态，读取侧接受它与 fail-closed 原则不冲突——未知值仍被拒绝。
2. **画像层同步透传**：`profile-center.ts` 的 `normalizeStatusMarkers` 采用同一允许集合，避免「缓存可读但画像丢标记」的新不一致。
3. **不抽共享常量**：两处白名单各只有一处定义，本次保持局部修改；「标记枚举单一真源」重构留作后续（见 Non-Goals）。
4. **回归测试走真实函数 round-trip**：写入 → 持久化 → 读取断言 `state` 与标记，而非只测 schema 函数单点，防止「写入侧新增标记忘记同步读取侧」这一类问题再次穿过测试缝隙。
5. **运维重建随修复验证**：用既有 `refreshStudentEvidenceFeatureCache` / 数据治理 worker 重建受影响学生缓存，断言 `state=ready` 且 `sourceCounts.LearningFact` 与实际合格证据数一致（Issue 验收条件 5）。

## Risks / Trade-offs

- 风险：白名单放宽可能掩盖未来真正的结构损坏。缓解：仅放行已定义语义的单一标记值，未知值仍 fail-closed，并有「未知标记 → stale」测试锁定。
- 权衡：推荐引擎层本就有独立混合身份防御，本次修复主要恢复 learner-state 与画像中心；这不构成重复防御的消除理由。
