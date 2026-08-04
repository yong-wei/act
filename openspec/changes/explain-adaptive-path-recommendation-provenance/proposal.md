## Why

正式候选学习路径目前只显示概括性的薄弱项数量和资源组合，学生无法核验哪些学习证据形成了能力判断，以及这些判断如何影响具体资源推荐。该缺口削弱了路径推荐的透明度，也使平台难以证明个性化路径确实由受治理学习证据驱动。

## What Changes

- 为正式候选路径生成持久化、学生安全的聚合推荐依据投影，按薄弱项连接生成时状态摘要、能力判断和受影响资源。
- 在候选路径卡片中常显关键摘要，并通过按需展开区域展示完整解释链和既有学习记录复核入口。
- 对证据不足的候选路径明确显示低置信度、规则依据和补充证据动作，不把缺失证据表述为可靠个性化结论。
- 保持路径规划、评分、候选差异解释和活动路径执行行为不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `adaptive-learning-path-planning`: 要求正式候选路径保存学生安全的“聚合状态 → 判断 → 路径资源”推荐依据，并保留生成时的解释事实。
- `adaptive-learning-center-ui`: 要求候选路径卡片显示推荐依据摘要、可展开解释链、证据复核入口和低置信度说明。

## Impact

- 路径规划输出与持久化投影：`src/lib/adaptive-learning-path-planner.ts`、`src/lib/adaptive-path-option-display.ts`。
- 学习路径页面：`src/app/assessment/adaptive-practice/page.tsx`。
- 相关 Vitest 合同与页面测试。
- 不新增依赖，不修改 Prisma、WASM、路径评分算法或活动路径执行接口。
- 本变更是 Issue #1186 的第一阶段，不关闭该 Issue；活动路径节点解释、节点调整说明和事件级证据回跳留待后续变更。
