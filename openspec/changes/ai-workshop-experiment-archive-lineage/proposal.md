## Why

AI 工坊的实验档案目前读取旧的 `SimulationLog` 和 `ArenaSubmission`，没有消费控制工作台与场景追踪已经持久化的标准 `SimulationRun`。学生完成实验后可能在 AI 工坊看不到真实运行记录；同一奥德赛活动还可能因跨表桥接被显示两次，且现有条目没有入口回到对应实验或复盘页面，学习陪伴链路因此无法闭环。

## What Changes

- 将当前学生已完成且具备展示资格的标准 `SimulationRun` 纳入实验档案投影。
- 为仿真、奥德赛和 Arena 条目保留来源类型、结果权威性和来源专属导航目标。
- 按稳定的跨来源实验身份合并同一次活动，避免标准运行、旧日志和 Arena 提交重复计数或重复展示。
- 对历史未桥接记录保留兼容读取，但不得覆盖标准运行的来源和结果语义。
- 增加服务端投影、学生端导航、来源权威性和跨来源去重的回归及浏览器验收。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `ai-workshop-governed-collections`: 实验集合必须消费标准仿真运行，携带来源专属导航，并对跨来源同一活动去重，同时保持学生归属、预览/正式边界和有界投影。

## Impact

- 影响 `src/features/ai/ai-workshop-collections.server.ts`、`src/features/ai/ai-workshop-collections.ts` 和 `src/features/ai/archive/experiment-archive.tsx`。
- 读取 `SimulationRun`、`SimulationTrace` 的安全摘要及其任务/来源上下文；兼容 `SimulationLog`、`ArenaSubmission` 与奥德赛桥接身份。
- 不新增学习事实，不改变官方评分、排行榜、普通奥德赛解锁或个人画像写回。
- 需要补充服务端单元测试、来源导航/去重测试和 `/ai` 的桌面端与 320px 浏览器验收。
