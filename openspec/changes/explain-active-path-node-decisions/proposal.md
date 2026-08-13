## Why

候选路径已经能够展示生成时聚合推荐依据，但学生进入活动路径后仍只能看到通用“推荐理由”，无法核验节点为何入选、最近一次已确认纠偏如何改变节点顺序，以及节点当前为何锁定。该缺口使 #1186 的推荐决策追溯在路径选择后中断。

## What Changes

- 为活动路径节点保存学生安全的入选决策投影，并在旧路径缺少投影时明确解释限制，不使用当前画像重构历史原因。
- 在学生确认纠偏时，以确认前的活动路径为调整基线，保存最近一次直接影响各节点的提前、延后、保留、替换或移除事实。
- 让节点详情分别展示历史入选依据、最近一次已确认调整和当前锁定依据；完成或跳过后仍保留历史决策解释。
- 当前锁定依据继续读取受治理 readiness 真值，随先修和证据状态更新，并只暴露学生安全的原因与解锁动作。
- 保留既有纠偏决策历史作为完整多轮记录，不在节点详情复制第二套时间线。
- 事件类型、发生时间和具体证据事件安全回跳继续留给 #1186 第三阶段。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `adaptive-learning-path-planning`: 要求活动路径节点保留学生安全的入选依据和最近一次已确认调整事实，同时把动态锁定说明与历史决策分离。
- `adaptive-path-correction-decisions`: 要求已确认纠偏从权威前后序列投影节点级调整结果，并随路径更新保存，不采用未确认候选或客户端提交序列。
- `adaptive-learning-center-ui`: 要求活动路径节点详情展示入选、调整、锁定和历史解释限制，覆盖完成、跳过、锁定及 320px 状态。

## Impact

- 路径节点与纠偏应用投影：`src/lib/adaptive-learning-path-planner.ts`、`src/lib/adaptive-path-correction-decisions.ts`。
- 活动路径旅程与页面映射：`src/features/adaptive/adaptive-path-journey-contracts.ts`、`src/app/assessment/adaptive-practice/page.tsx`。
- 相关 Vitest、页面合同测试及桌面端与 320px 浏览器验收。
- 不新增依赖，不修改 Prisma、WASM、路径评分、纠偏确认 API 或事件级学习证据接口。
- 本变更是 Issue #1186 第二阶段，不关闭该 Issue；事件级证据引用与安全回跳仍属后续范围。
