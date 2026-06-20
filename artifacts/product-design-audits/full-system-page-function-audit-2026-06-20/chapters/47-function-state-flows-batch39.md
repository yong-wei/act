# 功能状态流审计续篇（三十九）

日期：2026-06-20
基线：`dev1` 已对齐 `origin/integration`，HEAD `89a826ee53`。
范围：虚拟仿真目录、搜索/难度/模式/视图切换、课程设计弹窗、空搜索、`/virtual-lab` 兼容重定向，Cruise/Destoyer/Drilling 仿真运行态、Arena 任务入口、局部工具和移动端状态。
截图目录：`screenshots/74-function-state-flows-batch39/`
Manifest：`screenshots/function-state-flows-batch39-manifest.json`
本批新增截图：15 张，全部带 DOM/a11y JSON 快照；关键步骤带焦点路径、路由响应、局部工具标记和 canvas 统计。
账号：学生 `demo`。
真实夹具：Arena 任务 `task-cruise-roll-blackbox-identification`；搜索词 `动力定位`；空搜索词 `不存在的仿真对象`。

## 1. 本批审计顺序

1. 学生打开 `/simulations`，检查目录默认列表、搜索、难度、视图切换、模式 tabs 和继续实验入口。
2. 学生搜索 `动力定位`，检查结果缩减和结果数反馈。
3. 学生筛选挑战难度并切到“自由探索”，检查模式和难度组合后的可理解性。
4. 学生切到卡片视图，检查场景预览、进入仿真和课程设计动作。
5. 学生打开课程设计弹窗，检查目标、要点和开始实验动作。
6. 学生输入空搜索词，检查空态恢复路径。
7. 学生打开 `/virtual-lab`，检查兼容重定向后的上下文。
8. 学生打开 `/simulations/cruise`，检查非空 3D 场景、舒适性工具和结构化支持区。
9. 学生展开 Cruise “支持与证据状态”，检查回放/Arena/证据边界说明。
10. 学生打开 `/simulations/cruise?arenaTask=task-cruise-roll-blackbox-identification`，检查 Arena 预览/证据栏。
11. 学生打开 `/simulations/destroyer`，检查航向控制仿真局部工具。
12. 学生打开 `/simulations/drilling`，检查动力定位局部工具。
13. 学生移动端打开 `/simulations`，检查目录、导航和浮层关系。
14. 学生移动端搜索并切卡片视图，检查结果卡和启动动作。
15. 学生移动端打开 `/simulations/cruise`，检查场景、局部面板、底部工具和全局浮层关系。

## 2. 仿真目录、筛选和课程设计

证据：

- `01-student-simulations-catalog-default.png`
- `02-student-simulations-catalog-search.png`
- `03-student-simulations-catalog-advanced-explore.png`
- `04-student-simulations-catalog-card-view.png`
- `05-student-simulations-course-design-modal.png`
- `06-student-simulations-empty-search.png`
- `07-student-virtual-lab-redirect.png`
- `13-student-simulations-mobile-default.png`
- `14-student-simulations-mobile-search-card.png`

路由与 DOM 证据：

- `/simulations` 返回 200，默认列表视图有 7 个仿真对象。
- 搜索 `动力定位` 后结果缩减为 1 个仿真对象。
- 卡片视图有 7 张卡片；课程设计弹窗 `role=dialog` 可见。
- 空搜索后 `scenarioRows=0`、`scenarioCards=0`，显示“没有匹配的仿真对象”。
- `/virtual-lab` 返回 200，最终 URL 为 `/simulations`。

观察：

- 目录默认状态把“统一仿真目录”、搜索、难度、目录视图、结果数、全部仿真/课程任务/自由探索和 7 个仿真对象放在同一任务面。
- 列表视图的信息密度适合桌面，能同时看到对象、控制主题、难度、任务适配和操作。
- 搜索后结果数可见，但没有 `role=status` 或 `aria-live`；读屏用户不一定知道列表已被缩减。
- 高级/自由探索筛选组合后只剩 1 个结果，但页面没有解释“为什么剩下这个对象”或给出一键清空筛选。
- 课程设计弹窗能展示课程概述、学习目标、要点提示、控制重点和“开始仿真实验”，弹窗视觉完整。
- 空态只显示无匹配文案，没有“清空搜索”“重置筛选”“显示全部仿真”的直接恢复动作。
- `/virtual-lab` 兼容重定向到 `/simulations`，页面内没有说明这是兼容入口，用户无法分辨旧入口是否仍有独立含义。
- 移动端目录把平台导航、筛选、视图切换、结果数和 7 个对象拉成长页；控灵浮层覆盖目录视图切换/结果数区域。

问题：

- P2：仿真目录筛选结果缺少状态播报。搜索和筛选会改变结果数，但页面没有 live/status。
- P2：仿真目录空态缺少恢复动作。空搜索只给出文字，用户需要手动清空输入和筛选。
- P2：`/virtual-lab` 重定向缺少兼容说明。旧入口落到新目录，但页面不解释“虚拟实验室已合并到虚拟仿真”。
- P2：移动端仿真目录过长且浮层覆盖视图切换区。用户在手机上需要长滚动才能比较全部对象，且全局控灵浮层压住目录工具。

建议：

- 搜索、难度和模式变化后写入 `role=status`，例如“当前显示 1 个仿真”。
- 空态增加“清空搜索”“重置筛选”“显示全部仿真”。
- `/virtual-lab` 落地页顶部可以显示一次性兼容提示。
- 移动端目录应提供可折叠筛选栏、粘性结果摘要或更短的对象卡片。

## 3. 仿真运行态与局部工具

证据：

- `08-student-cruise-simulation-standalone.png`
- `09-student-cruise-support-drawer.png`
- `11-student-destroyer-simulation-local-tools.png`
- `12-student-drilling-simulation-local-tools.png`
- `15-student-cruise-simulation-mobile.png`

DOM 与视觉证据：

- Cruise、Destroyer、Drilling 详情均返回 200，均有 1 个 canvas。
- 三个仿真详情都存在 `data-commercial-workspace="simulation-scene"`、`instrument-area` 和 `bottom-tools` 标记。
- `bottomTools=true` 但 `visibleBottomTools=false`，局部底部工具合同存在于 DOM，但实际隐藏。
- Cruise 桌面场景非空，左侧状态监控、右侧控制与探究、底部相机/俯瞰/战术/网格/速度工具可见。
- 移动端 Cruise 场景非空，但全局控灵浮层覆盖场景顶部区域，底部相机/网格/速度工具与浮层距离很近。

观察：

- Cruise 仿真桌面场景视觉完整，能看到邮轮、水面、网格、状态监控、控制参数、海况、相对波向、控制模式和减摇鳍。
- AppShell 下方有“独立探索”和“支持与证据状态”，能解释独立启动和回放/Arena 边界。
- `SimulationLocalToolWorkspace` 另外渲染了“舒适性状态/频域与评价”等模板面板，但在桌面被隐藏；真实可见的是仿真组件自身的左/右工具栏。
- Destroyer 和 Drilling 同样有组件自身的状态/控制面板，但统一的 `bottom-tools` 合同标记为隐藏。
- 移动端 Cruise 把场景、提示条、相机/网格/速度工具和下方局部面板堆叠，能使用但视觉空间紧张。

问题：

- P1：仿真命令甲板 `bottom-tools` 合同存在但不可见。DOM 有 `data-task-workspace-zone="bottom-tools"`，但 class 为 hidden，不能证明底部工具区已交付。
- P1：移动端仿真场景工具被全局浮层干扰。控灵浮层覆盖场景上方，并挤压底部相机、网格和速度工具。
- P2：桌面仿真存在两套局部工具语义。组件自身的状态/控制面板可见，统一模板面板在 DOM 中隐藏，审计和读屏会看到不一致的工具结构。
- P2：仿真运行态关键控制缺少完成状态。开始仿真、重置、模式切换和参数调整在首屏可见，但没有明显 status/live 完成播报。

建议：

- 若底部工具是合同要求，应让 `bottom-tools` 可见并承载相机、网格、速度、记录/导出等命令；若暂不交付，不应用隐藏 DOM 冒充完成。
- 移动端为全局控灵和场景底部工具建立统一 safe area，避免覆盖相机/速度控制。
- 统一 `SimulationLocalToolWorkspace` 与具体仿真组件的工具结构，避免同一页出现隐藏模板工具和可见组件工具两套语义。
- 开始、重置、模式切换和参数变更后增加状态播报与当前仿真时间/目标确认。

## 4. Arena 任务入口

证据：

- `10-student-cruise-arena-task-context.png`

路由与 DOM 证据：

- `/simulations/cruise?arenaTask=task-cruise-roll-blackbox-identification` 返回 200。
- 页面出现 `evidence-rail`，右侧显示“黑箱辨识工作台”和提交按钮。
- 页面文字显示“Arena 预览”，说明该体验用于公开预览或虚拟试运行，不作为官方榜单证据。

观察：

- Arena 任务入口能把 Cruise 仿真场景和黑箱辨识工作台放到同一页面，场景仍然非空。
- 右侧黑箱辨识表单可见，但表单标签出现竖排挤压：如“当前辨识质量图谱”“重置实验次数”“系统后用黑箱实验或名义模型视图”等字样被压成单字列。
- “导入虚拟仿真预演”和“提交黑箱评测”可见，但与当前是否官方评价、是否会进入榜单的边界仍主要靠上下文文本解释。

问题：

- P1：Arena 黑箱工作台表单在仿真页右侧被挤压。字段标签竖排，阅读和填写成本高。
- P2：Arena 预览与官方评测边界仍弱。页面显示预览说明，但提交按钮仍叫“提交黑箱评测”，容易让学生误解是否进入正式评价。

建议：

- 右侧 `evidence-rail` 应给黑箱表单最小宽度或改成下方宽面板，避免标签竖排。
- 预览态提交按钮应写清“提交预览评测”或禁用正式提交文案，并显示是否计入榜单/证据。

## 5. 本批新增优先问题

220. P1：仿真命令甲板 `bottom-tools` 合同存在但不可见。
     Cruise、Destroyer、Drilling 均有 `data-task-workspace-zone="bottom-tools"`，但实际 `visibleBottomTools=false`。

221. P1：移动端仿真场景工具被全局浮层干扰。
     Cruise 移动端中控灵浮层覆盖场景区域，底部相机/网格/速度工具与浮层冲突。

222. P1：Arena 黑箱工作台表单在仿真页右侧被挤压。
     Cruise Arena 任务入口的右侧字段标签出现竖排单字列，影响填写和理解。

223. P2：仿真目录筛选结果缺少状态播报。
     搜索和筛选后结果数变化可见，但没有 `role=status` 或 `aria-live`。

224. P2：仿真目录空态缺少恢复动作。
     空搜索只显示无匹配文案，没有清空搜索或重置筛选按钮。

225. P2：`/virtual-lab` 重定向缺少兼容说明。
     旧入口最终落到 `/simulations`，页面没有解释入口合并或新旧路径关系。

226. P2：移动端仿真目录过长且浮层覆盖视图切换区。
     移动端默认目录高 3809px，控灵浮层压住目录视图切换和结果摘要区域。

## 6. 本批脚本与统计备注

- 本批 manifest 为 15 张截图、15 条 DOM/a11y JSON、1 个 API 检查、6 个 optional action、0 条 errors、0 条 ignoredErrors。
- 本批没有写入业务数据，只检查目录、路由、弹窗、运行态场景和 Arena 任务入口状态。
- 本批新增 `scripts/capture-batch39.mjs`，覆盖桌面与移动、目录与运行态、标准仿真与 Arena 入口。
- 本批重新统计整份审计真实 PNG 数量后，当前总数为 840。
