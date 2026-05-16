## Why

Arena 当前已经具备挑战任务、工作台、官方评测和榜单的基本链路，但学生可见入口仍混有详情页提交、英文协议字段、非真实知识点字符串和不一致的工作台控制语义。需要将竞技场大厅、挑战详情、工作台和官方评测收束为同一条可信路径：从挑战入口进入工作台，在工作台调试并提交，官方评测通过后进入榜单。

## What Changes

- 重构 `/arena` 大厅和 `/arena/challenges/[taskId]` 详情页为统一竞技场视觉与信息架构：左侧项目总入口、顶部真实路径面包屑、中央挑战内容、右侧只读榜单。
- 从公开导航和竞技场入口体系删除评审入口，不删除已有 `/review` 路由和内部审查页面。
- 详情页不再提供控制器参数提交和工作台仿真，只保留进入对应工作台的入口；官方提交仅在工作台内部发生。
- 详情页对象说明中的白箱模型使用 LaTeX 渲染；评价规则拆为基础目标表格和硬约束模块；硬约束、同分规则、榜单摘要全部中文显示。
- 榜单学生可见类型收束为主榜、方法榜、指标榜；不移除底层 `class`、`season`、`pareto` 类型，避免破坏教师配置和历史数据。
- 相关知识点改为真实知识图谱节点引用，点击后显示知识预览、知识卡片和可用信息图。
- 修复白箱官方硬约束稳定性口径，尤其是 PID 家族中 PD/PI/PID 的等效传函构造，保证工作台稳定判断与官方闭环稳定检查一致。
- 重构多表征工作台参数抽屉和校正装置语义：校正启用后所有可调控制器参数包括开环增益都在校正装置区域编辑，数字输入支持两位小数、步进 1 和全文替换。
- 工作台文案全部中文，公式严格使用 LaTeX；三域图表修复时域默认范围、根轨迹等效增益、零极点拖动与参数抽屉双向联动。

## Capabilities

### New Capabilities

- `arena-student-entry-experience`: 竞技场大厅和挑战详情的学生入口、导航、评价规则、榜单展示和提交边界。
- `arena-knowledge-node-preview`: 竞技场相关知识点必须链接真实知识图谱节点，并展示知识预览、知识卡片和信息图。
- `arena-workbench-correction-controls`: 多表征工作台中的中文化、LaTeX 公式、参数抽屉、校正器增益、数值输入和三域联动行为。
- `arena-official-evaluation-consistency`: 工作台提交、官方评测、硬约束检查和榜单入榜口径必须一致。

### Modified Capabilities

无现有 spec 被修改（项目当前 `openspec/specs/` 为空，本次创建新能力 spec）。

## Impact

- `src/features/arena/arena-hall.tsx`, `src/features/arena/challenge-detail.tsx`, `src/app/page.tsx`, `src/app/(auth)/layout.tsx` — 学生入口、导航、详情页和公开评审入口清理。
- `src/features/arena/data/seed-challenges.ts`, `src/features/arena/types.ts`, `course-content/runtime/knowledge/graph/nodes.json` — 真实知识节点引用、模型 LaTeX 字段、中文展示标签。
- `src/features/arena/evaluation/whitebox-evaluator.ts`, `src/features/arena/evaluation/metric-profile-evaluator.ts`, `src/features/arena/workbench/artifact-mappers.ts` — 官方硬约束、指标、提交参数和榜单入榜一致性。
- `src/features/interactive/multi-representation-linkage/` — 工作台页面、参数抽屉、提交面板、状态模型和控制器 artifact 生成。
- `src/resources/control-system/charts/control-analysis-panels.tsx` — 时域响应默认范围、根轨迹增益状态栏和拖动联动。
- 测试影响包括 Arena route/home smoke scripts、Arena evaluation/leaderboard/artifact mapper Vitest、多表征工作台测试，以及必要的浏览器截图验证。
