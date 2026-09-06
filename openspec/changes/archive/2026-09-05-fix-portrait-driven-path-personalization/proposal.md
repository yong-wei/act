## Why

Issue #1984 反馈：学生个人中心已有能力画像与能力快照，但生成「控制系统校正设计」学习路径时服务端主画像状态为 `UNAVAILABLE`（原因 `migration-in-progress`），能力数据退化为旧兼容数据、多数维度为 0，候选路径的目标缺陷完全相同，未体现学生真实优势、薄弱项或能力证据；页面也没有「无法个性化推荐」的明确提示，输出看似个性化的结果。

根因（已调查确认）：

- 画像读取 fail-closed：`readCurrentCumulativePortrait`（`src/lib/data-governance/cumulative-portrait-read-model.ts:234`）在 cutover fence 缺失、`calculationVersion` 与 `PORTRAIT_V2_CALCULATION_VERSION` 漂移，或 `activeMigrationRunId` 指向的 run 不满足 `APPLY + COMPLETED + 同代际` 时，整体返回 `unavailable('migration-in-progress')`。版本演进或环境未收尾时画像长期不可用，且消费侧无收敛路径与可见性。
- 静默退化：`resolveFencedAdaptivePortrait`（`src/features/personalization/learner-state/effectful-reads.ts`）在读取非权威时置 `primaryPortrait = null`、状态 `UNAVAILABLE`，能力向量回落 `legacyCompatibility`（旧 `StudentCompetencySnapshot` 或空向量），该向量被继续用于输出。
- 缺陷伪造：`inferDeficits`（`src/features/personalization/path-planning/internal/assemble-plan.ts:2767`）在画像维度缺失（`portraitScores.length === 0`）时把能力目标记为 0 分 deficit；所有候选项共享同一份退化缺陷表，呈现为「完全相同的目标薄弱项」。
- 状态不可见：路径生成与路径中心没有把 `primaryPortraitState/availabilityReason` 透出为「个性化不可用」状态与原因，违反既有 spec「planner SHALL NOT construct personalization claims from legacy portrait data」与「Learner-state no-data states are explicit」的精神。

## What Changes

- 画像可用性显式透出：learner-state 读模型与路径生成结果携带主画像可用性与原因（如 `migration-in-progress`）；画像不可用时路径中心明确提示「当前无法个性化推荐」，并说明按通用学习路线生成。
- 停止伪造个性化：主画像不可用或维度证据缺失时，能力类 target deficits 标注「无画像证据」，不得以 0 分伪造成能力缺陷；候选路径的推荐依据不得引用退化的 legacy 兼容向量作为个性化主张。legacy 兼容向量仅保留为非权威兼容输出，不再进入缺陷推断与推荐依据。
- 画像可用时的真实个性化：主画像权威可读时，候选路径的 `targetDeficits`/`recommendationProvenance` 至少引用一个具体能力维度、知识缺口或学习证据；推荐依据能解释「画像中的哪个问题导致了路径中的哪项安排」。
- fence 收敛可见性：`PORTRAIT_V2_CALCULATION_VERSION` 演进后，migration run 的初始化与收尾（fence → APPLY COMPLETED → 画像可读）提供可执行验证（脚本或治理面板可见状态），使部署环境可从 `migration-in-progress` 收敛到 available，并纳入发布验收。
- 登录态回归测试：画像不可用（fence 不满足）→ 显式不可用状态且无伪造个性化主张；画像可用 → 候选引用具体维度与证据、目标薄弱项与画像一致。

## Capabilities

### Modified Capabilities

- `adaptive-learner-state-service`: 主画像不可用的显式状态与原因合同；fence 版本演进后的收敛验证可见性。
- `adaptive-learning-path-planning`: 能力缺陷推断的证据诚实性（无画像证据不伪造 0 分缺陷）与个性化主张的证据引用要求。
- `adaptive-learning-center-ui`: 路径中心呈现个性化不可用状态与原因，区分「个性化推荐」与「通用路线」。

## Impact

- `src/lib/data-governance/cumulative-portrait-read-model.ts`、`src/features/personalization/learner-state/effectful-reads.ts`、`reducer.ts`（画像可用性透出与 legacy 向量隔离）。
- `src/features/personalization/path-planning/internal/assemble-plan.ts`（`inferDeficits`、推荐依据构建）。
- 路径中心页面学习状态与推荐依据呈现（`src/app/assessment/adaptive-practice/page.tsx` 相关区块）。
- fence 收敛验证脚本或治理面板状态呈现；不改变画像物化与快照调度（属进行中变更 `restore-incremental-learning-state-truth` 范围）、不新增画像维度、不修改 Prisma schema。
- 本变更不负责 #1985 的资源偏好优先级；偏好推断可用性依赖本变更的画像可用性合同。
