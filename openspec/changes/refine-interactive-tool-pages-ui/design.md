## Context

- `/interactive-learning/pid-simulator` 与 `/interactive-learning/control-map` 在 `platform-appshell-contract.ts` 中以 `legacy-demo-only` 豁免登记，移除条件是“迁入 InteractiveLearningShell”。
- PID 仿真器同时以 `sim-pid-v1` 注册为课程资源。DB BOPPPS 渲染器以 `embedded: true` 挂载它，不传 `onComplete` 或 `onStateChange`；完成状态由外层 `InteractiveProvider` 管理。
- 数值模型已走 Rust 批量仿真 `runPidBatchSimulation`，返回 `times / response / setpoint` 与 `finalValue / steadyStateError / overshootPercent`。
- 控制工作台的经典预设嵌入 `MultiRepresentationLinkageClient`，后者处于 `premium-lesson-theme-scope`。浅色主题下，精品课主题变量把面板渲染为青色渐变。
- 仿真页已有 `simulation-panels.tsx` 统一构件（`SimPanelSection`、`SimReadout`、`SimField`、`SimSegmented`、`SimNotice`、`SimChip`），只使用平台语义色。

## Goals / Non-Goals

**Goals**
- 两个遗留演示页获得平台外壳、面包屑与主题切换，并移除对应豁免。
- 三个工具页在深浅主题下都可读，颜色全部来自平台 token。
- PID 进入即有结果、调参即时反馈、指标可见；上报只发生在显式记录时。
- 控制理论地图的着色、筛选、搜索与侧栏行为可预期。

**Non-Goals**
- 不修改 PID 对象模型、Rust 仿真接口或数值步长以外的计算语义。
- 不修改工作台快照、指标对照、稳定裕度与提交逻辑，也不修改精品课全局主题。
- 不改控制理论地图的知识数据、节点坐标或关系定义。
- 不新增数据库字段、事件类型或运行态内容。

## Decisions

### 外壳

- 两个页面的 `page.tsx` 直接渲染 `InteractiveLearningShell`，以满足路由覆盖扫描。
- `InteractiveLearningShell` 增加 `fillViewport` 透传，供控制理论地图做全高画布；面包屑登记到 `INTERACTIVE_LEARNING_BREADCRUMBS`。
- PID 组件保留 `embedded` 与 `showBackLink` 入参兼容。独立页不再渲染组件自带的标题栏，标题交给外壳；嵌入模式保留紧凑工具条。

### PID 控制仿真器

- 复用 `simulation-panels.tsx` 构件与 `@/components/ui/slider`。
- 参数范围：
  - Kp：0–10，步长 0.05。
  - Ki：0–2，步长 0.01。
  - Kd：0–5，步长 0.05。
  - 目标值：0.2–2，步长 0.1。
  - 若初始配置超出默认上限，上限扩展到该初值，避免钳制课程配置。
- 仿真时长使用分段选择（10 / 20 / 40 s），默认 20 s。积分步长固定为 0.02 s，不向学生展示。
- 预览：
  - 运行时就绪后立即以当前参数运行一次。
  - 参数变化后经 150 ms 防抖重新运行。
  - 预览不调用 `onStateChange` 或 `onComplete`。
- 记录：
  - 仅当调用方传入 `onStateChange` 或 `onComplete` 时显示“记录本次结果”。
  - 点击后以最新预览结果调用回调，载荷与原“运行仿真”一致。
- 发散判定（命中任一条即标记“当前参数使闭环发散”，并以警示色显示读数）：
  - 响应含非有限值，或最大幅值超过 `max(50, 50·|目标值|)`。此时把纵轴钳制在 `[-2r, 3r]`。
  - 末四分之一窗口内的最大偏差 `|y−r|`，比此前全部样本（含初始偏差）的最大偏差大 5% 以上，即振幅仍在增大。此时纵轴保持自动，让增长的包络可见。
  - 已用连续时间模型在六个对象、参数网格、三种时长和三种目标值下交叉验证（13,554 组）：稳定闭环零误报。漏报集中在振荡周期接近或长于仿真窗口的缓慢发散，这类情形无法仅凭时域窗口与大超调的稳定响应区分，学生仍可从曲线与超调读数看出异常。
  - 不在前端求闭环极点；若后续需要精确稳定性判定，应由控制内核返回。
- 图表从 Chart.js 换为 Recharts。SVG 描边直接使用 `hsl(var(--platform-chart-*))`，随主题自动切换，不再手动维护 Chart 实例与颜色。
- 运行时加载失败时显示中性提示“仿真暂不可用，请刷新后重试”，不暴露实现细节。

### 控制理论地图

- 区域色映射到平台 token：
  - 建模与仿真：`--platform-brand-danger`。
  - 系统分析：`--platform-chart-3`。
  - 经典控制：`--platform-chart-1`。
  - 现代与最优控制：`--platform-chart-5`。
  - 非线性与智能控制：`--platform-chart-6`。
  - `zoneConfigs` 的 `color / bgColor / borderColor` 改为 `hsl(var(--token) / α)` 字符串，节点、图例、小地图与侧栏共用。
- 节点：
  - 表面为 `platform-surface`，左侧区域色条，中文名为 `fg-primary`，英文名为 `fg-muted`。
  - 选中时显示区域色描边与外发光；关联节点显示区域色描边。
  - 未命中时透明度 0.25。
- 连线默认 `platform-border-strong`，高亮为 `platform-action-primary`。有选中或悬停时，非关联连线降为 0.2 透明度。连线类型由 `smoothstep` 改为 `default`，减少正交折线的重叠。
- 筛选：每组至少保留一项，最后一项按钮 `aria-disabled` 并提示“至少保留一项”。
- 搜索：
  - 显示命中数，无命中时提示“未找到匹配概念”。
  - 回车选中首个命中，并调用 `fitView` 定位到该节点。
- 侧栏：Esc 关闭；样式改为 token 浮层。
- React Flow 的 `colorMode` 跟随应用主题。React Flow 会在画布根节点写入 `light`/`dark` 类，而平台 token 按这两个类取值；默认值 `light` 会让深色主题下的画布内部取到浅色 token。
- 工具栏（搜索、筛选）改为画布内右上浮层，图例在左上，操作提示与区域数在左下。

### 控制工作台

- 标题行：探索模式只显示 `modeLabel`；其他模式保持“模式 · 工作区”。
- 删除探索模式下与“证据状态”重复的说明段；挑战说明段改为学生语言。
- 经典预设容器改为 `border-platform-border bg-platform-canvas-muted/60`。
- 在 `globals.css` 中以 `[data-commercial-workspace='control-workbench'] .premium-lesson-theme-scope` 覆盖精品课主题变量，把 surface、border、kicker、chip、input 映射到平台中性 token。只影响工作台，不影响精品课与多表征联动独立页。
- 学生可见文案：
  - “提交结果进入 Arena 官方评价” 改为 “提交结果进入竞技场官方评价”。
  - “支持与说明”改写为学生语言。
  - `describeExperienceLaunch` 的 `standalone / course-launched` 摘要去除 “Arena / DB BOPPPS”。
  - `arena-preview` 标签改为“竞技场预览”，并同步合同测试。

## Risks / Trade-offs

- Recharts 渲染 2000 点折线时比 Chart.js 慢。40 s / 0.02 s 共 2000 点，关闭动画与点后可接受；必要时可降采样到 ≤800 点用于显示，读数仍用完整结果。
- 自动预览会在每次调参后调用一次 WASM 批量仿真，单次计算为毫秒级，以防抖控制频率。
- 移除豁免后，两个页面受外壳合同与视觉治理约束；任何回退都需要同时恢复豁免。
