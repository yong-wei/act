# Design: fix-portrait-driven-path-personalization

## 根因模型

四层叠加：

1. **fence fail-closed**（`cumulative-portrait-read-model.ts:234`）：`CumulativePortraitCutoverFence` 缺失 / `calculationVersion !== PORTRAIT_V2_CALCULATION_VERSION`（当前 `portrait-v2-cumulative.v3`）/ `activeMigrationRunId` 的 run 不满足 `APPLY + COMPLETED + 同 learnerGeneration/queueGeneration/cutoverFence` → `unavailable('migration-in-progress')`。该语义本身正确（治理 fail-closed），问题是版本演进后没有可见、可执行的收敛验收，环境长期滞留。
2. **静默兼容退化**（`learner-state/effectful-reads.ts` `resolveFencedAdaptivePortrait`）：非权威读取 → `primaryPortrait = null` + `UNAVAILABLE`，同时保留 `legacyCompatibility.vector`（旧快照或空向量）。注释标记 `PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative compatibility vector retained for legacy output only`，但下游缺陷推断仍消费该退化向量。
3. **缺陷伪造**（`assemble-plan.ts:2767` `inferDeficits`）：`usablePortraitDimensionsForTarget` 为空 → value/confidence/evidenceCount 全 0 → 全部能力目标成为 0 分 deficit；四条候选共享同一退化表。
4. **状态不透出**：`primaryPortraitState/primaryPortraitAvailability` 停留在 learner-state 内部，路径生成结果与页面无「个性化不可用」呈现，输出看似个性化。

## 决策

- **保留 fence fail-closed 语义，补收敛验收。** 不放松读模型的治理判定；提供 fence/迁移收尾的验证脚本（或治理面板状态），并在发布验收中检查「学生画像可读」，使 `migration-in-progress` 成为可收敛的过渡态。
- **legacy 兼容向量从个性化链路剥离。** `resolveFencedAdaptivePortrait` 继续返回 legacyCompatibility（兼容输出合同不变），但 reducer/规划器消费侧不再用它构造能力维度与缺陷；能力缺陷只来自权威画像。
- **deficit 三态化。** `inferDeficits` 能力类目标在画像可用但维度缺失时输出「无画像证据」降级态（类似既有 `NO_EVIDENCE` 语义），value 不再虚构 0 分；reasonCode 区分 `competency-deficit` / `competency-maintenance` / `competency-no-portrait-evidence`。知识类缺口继续来自 `knowledgeMastery`（不依赖 portrait fence，保持现状）。
- **可用性透出复用既有结构。** `primaryPortraitState/Availability` 已存在于 learner-state 读结果；将其纳入路径生成结果的 `explanations/limitations` 与学习状态接口，页面按状态渲染提示，不新增独立通道。
- **推荐依据解释链。** `recommendationProvenance` 已携带 deficits 与证据快照；画像可用时补充「维度/缺口 → 安排」的映射说明字段，画像不可用时改为通用路线语义。

## 边界与不重叠确认

- 进行中变更 `restore-incremental-learning-state-truth` 管画像物化 job 调度与增量 append 语义；本变更管消费侧可用性显式化与个性化诚实性，不修改 worker/物化行为。
- 进行中变更 `student-profile-canonical-simulation-runs`、`project-profile-evidence-projection`、`reconcile-arena-profile-training-summary` 分别管个人中心仿真统计、画像证据投影与训练摘要口径，与本变更消费面不重叠。
- 不修改 `PORTRAIT_V2_CALCULATION_VERSION` 本身、不新增画像维度、不做画像 schema 迁移。

## 测试策略

- 读模型：fence 不满足（缺失/版本漂移/run 未完成）→ `UNAVAILABLE + migration-in-progress`；构造满足态 → `SNAPSHOT/available`。
- learner-state：画像不可用时能力向量输出标记非权威，且不进入规划器 deficits 输入。
- 规划器：画像不可用 → 能力目标为「无画像证据」态、推荐依据无 0 分能力主张；画像可用（含具体维度分数）→ deficits 与画像一致、`recommendationProvenance` 引用维度/证据、不同画像产生不同薄弱项。
- 页面合同：不可用状态提示与通用路线语义；可用状态解释链呈现。
- 登录态接口回归：学习状态接口返回主画像状态与原因。
