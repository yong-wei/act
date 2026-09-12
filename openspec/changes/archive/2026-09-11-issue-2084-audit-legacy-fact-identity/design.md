# Design: issue-2084-audit-legacy-fact-identity

## Context

- 身份列与解析：`LearningFact.knowledgeIdentityNamespace`（LEGACY | CANONICAL | null）等列存在；null 命名空间或无 revision 的行被 serving 投影解析为 `LEGACY_UNVERSIONED`（`canonical-learning-fact-identity/serving.ts:71-131`）。schema 注释明确「historical rows keep null namespace」「no historical backfill」（`schema.prisma:5280-5284`）。
- 写入权威：生产至今仍走 LEGACY 权威（`authority.ts:46-72`，`CUTOVER_ACTIVATION` 抛 `cutover-not-implemented`）。
- 已有防护：混合版本覆盖 → `singleVersionComparable=false`、`availability='mixed-version'`（`student-evidence-feature-cache.ts:1378-1411`）；推荐引擎对混合版本 fail-closed（confidence ≤0.45、state `partial`，缓存背书推荐输出为空，`engine.ts:948-998`、`:1573-1585`）；spec 禁止 full backfill 与 Canonical sidecar（`canonical-knowledge-learning-fact-identity`）；DB CHECK 约束强制身份完整性。
- 缺口：三分类审计清单、幂等隔离操作、画像展示、质量报告均不存在。`knowledgeIdentityCoverage`/`knowledgeIdentityLayers` 已算出但仅推荐引擎消费；`/api/user/profile` 不 select 身份列（`route.ts:511-526`）。
- 相邻机制：零权重治理（`profileWeight:0`/`skipProfileContribution`，归档 2026-08-13「不回填或推断历史未治理事实」）；`sourceEventId` 唯一约束 + skipDuplicates 提供幂等基础；任何写新行必须走 Legacy adapter（`inventory.ts:29-35`）。

## Goals / Non-Goals

**Goals:**

- 只读审计清单：三分类（可确定回填/映射、只能映射到 legacy、无法确定），含执行 revision、前后摘要、异常记录。
- 幂等隔离：无法确定身份的事实降为零权重上下文，可审计、可恢复、重复执行无副作用。
- 画像展示：按知识身份分组统计与混合版本限制对学生可见。
- 迁移前后数据质量报告。

**Non-Goals:**

- 不修改「Historical facts remain Legacy-bound」禁回填条款；不向历史行写 CANONICAL 列。
- 不改变推荐引擎对混合版本的 fail-closed 行为。
- 不删除或改写历史事实字节；crosswalk 只做读时解析。
- CANONICAL 回填单独立项（以 spec 修订与写入权威切换为前提）。

## Decisions

1. **审计先行、只读零风险**：第一阶段只输出不可变报告（输入、规则、执行 revision、前后计数摘要、异常记录），复用 serving 投影 + crosswalk 索引做三分类，不写任何数据。
2. **隔离而非回填为默认边界**：无法确定身份的事实经既有 quality-weight 机制降为零权重上下文（不参与要求单版本可比性的高置信度个性化），治理记录走 append-only `LearnerFactTransition`，按 `sourceEventId` 去重保证幂等。
3. **展示复用已算出的覆盖结构**：把 `knowledgeIdentityCoverage`/`knowledgeIdentityLayers` 暴露到画像 API 与学生状态面，不新增计算逻辑。
4. **分阶段落地**：审计清单 → 画像展示 → 隔离执行；每阶段独立可验证，隔离执行以审计报告为输入。
5. **可恢复**：隔离操作记录完整前后状态，支持按治理记录逆向恢复；恢复路径随质量报告一并交付。

## Risks / Trade-offs

- 风险：三分类中「可确定回填/映射」类若被误用为回填依据会触碰 spec 禁回填条款。缓解：本 change 的写操作仅限零权重隔离；回填类别只作报告输出，任何后续回填须单独立项并先修订 spec。
- 风险：隔离降低部分账号的个性化可用性。缓解：这些事实当前已因混合版本 fail-closed 而无法贡献高置信度推荐，隔离使其状态显式化而非进一步收紧。
- 权衡：不追求把 59 条混合事实「救回」单版本可比——证据来源不可伪造是更高优先级不变量。
