## Why

Issue #1167：学习路径锁定节点目前只展示“稍后解锁”或单条 `unlockMessage`，学生无法知道为什么锁定、当前缺哪些前置条件、完成什么动作后会解锁。个性化学习路径已经具备 readiness、prerequisite、checkpoint 等依赖语义，但展示层没有把已有数据转换成可执行的解锁链路。

## What Changes

- 在自适应学习路径中心为锁定节点增加学生可见的解锁链路。
- 解锁链路由现有 `pathPlan.mainPath[].readiness` 派生，不新增全局进度图，不改变 Planner 生成逻辑，不扩展持久化路径 payload。
- 在路径选项预览和已选路径执行时间线/节点详情中展示同一套解锁链路。
- 锁定节点展示三部分：锁定原因、缺失条件清单（尽量给出当前值与要求值）、下一步解锁动作。
- 下一步解锁动作在有可执行目标时提供跳转，否则仅显示文本。
- 降级策略：结构化解锁缺口 -> `fallbackNodeIds` / `prerequisiteNodeIds` -> `unlockMessage` -> 明确说明“暂时无法展示具体解锁条件”，不编造链路。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `adaptive-learning-center-ui`: 锁定节点不再只展示结果状态，必须展示由 readiness 派生、学生可理解且可执行的解锁链路与下一步动作。

## Impact

- `src/app/assessment/adaptive-practice/page.tsx`
- `src/lib/adaptive-path-option-display.ts`
- `src/features/adaptive/adaptive-path-journey-contracts.ts`
- 可能新增一个纯展示层函数，负责把 readiness 转换为学生可见解锁链路
- 相关测试：路径选项预览、执行时间线、缺失字段降级、多条 readiness 缺口
- 相关 spec：`adaptive-learning-center-ui`
