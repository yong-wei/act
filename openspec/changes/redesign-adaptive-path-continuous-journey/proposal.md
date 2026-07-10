## Why

当前学习路径把节点、详情和操作拆成相距很远的大块区域，长路径下难以判断所选节点及可执行动作，移动端还会发生标题逐字换行。节点启动后的页面只提供返回路径，缺少完成后直接进入下一节点的连续体验；Arena 节点还可能退化为竞技场首页并丢失路径上下文。

## What Changes

- 将路径执行视图改为紧凑的自适应时间线：节点以小型卡片和连续连接线表达顺序，所选节点在原位展开详情和操作。
- 以资源类型的语义色、图标和文字共同区分知识、练习、仿真、工作台、Arena 等节点，同时以独立的状态标记表达当前、完成、锁定和阻塞状态。
- 精简执行页的重复概况与统计容器，使路径、当前节点和主要动作成为首要信息，并修复桌面与移动端重排。
- 建立覆盖受治理内部节点与外部资源 fallback 的路径旅程控制：保留“返回学习路径”，在服务端确认完成并解析下一节点后启用“下一步”，在阻塞、待同步或路径结束时显示明确状态。
- 要求 Arena 路径节点绑定具体挑战任务，导航到 `/arena/challenges/<taskId>`，并在挑战详情与控制工作台之间持续传递路径上下文。
- 增加路径节点交互、完成后前进、Arena 上下文传递和 1440px/375px 响应式验收。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `adaptive-learning-center-ui`: 规定紧凑路径时间线、资源类型视觉编码、节点内联操作、任务优先信息层级和响应式行为。
- `adaptive-learning-path-planning`: 规定服务端拥有的下一节点导航状态、完成后连续前进、阻塞语义和具体可执行目标约束。
- `resource-node-registry`: 要求 Arena 路径节点绑定稳定任务标识与可验证的具体挑战地址，禁止以竞技场首页或知识节点占位。
- `arena-student-entry-experience`: 使具体挑战详情识别路径启动上下文，并显示路径返回与下一步状态。
- `arena-control-workbench-routing`: 在挑战详情、Control Odyssey 和统一控制工作台之间保留路径上下文与完成后的旅程控制。

## Impact

- 主要影响 `src/app/assessment/adaptive-practice/page.tsx`、自适应路径契约与执行 API、受治理知识/教材/课程/测验/反思/控灵目标、外部资源 fallback、Arena challenge 页面、Arena workspace routing 和控制工作台壳层。
- 路径执行写入接口需要返回或提供经授权的旅程导航视图；客户端不得自行推断下一节点或绕过 readiness/evidence gate。
- 杨帆诊断 fixture 及相关种子、恢复与审计测试需要改为真实 Arena task 语义。
- 不改变 Arena 官方评分权威、路径完成证据门槛或现有非路径入口的默认返回行为。
