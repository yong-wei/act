## Why

互动学习下的三个独立工具页与平台其余页面明显脱节：PID 控制仿真器与控制理论地图仍是登记在册的“待迁移遗留演示页”，没有平台侧栏和面包屑，颜色写死为深色板，浅色主题下图例、节点和曲线难以辨认；PID 仿真器进入后曲线为空、已计算的性能指标不展示、学生可见的“步长 (ms)”暴露数值实现；控制理论地图节点平时全为灰色、筛选组可被全部关闭导致整图失效、搜索没有命中反馈。控制工作台的标题信息重复，嵌入的分析区在浅色主题下呈大块灰底与青色卡片，并向学生展示“Arena”“商业工作区”等内部用语。

## What Changes

- PID 控制仿真器与控制理论地图迁入 `InteractiveLearningShell`，移除其遗留演示豁免并登记到外壳的路由族。
- 三个工具页统一采用与仿真 HUD、知识图谱一致的“仪表盘”分层质感：表面、文字、边框、图表与区域色全部来自平台 token，深浅主题均可读。
- PID 控制仿真器：
  - 参数改为滑块加读数，进入页面即显示默认参数的响应，调参后自动刷新预览。
  - 展示超调量、稳态误差与终值读数，识别发散响应。
  - 用“仿真时长”替代“步长 / 时间倍率”。
  - 只有学生显式“记录本次结果”时才向课堂回调上报。
- 控制理论地图：
  - 节点始终按知识区域着色。
  - 每个筛选组至少保留一项。
  - 搜索显示命中数，回车定位首个命中。
  - 详情侧栏可用 Esc 关闭。
  - 工具栏改为画布内浮层。
- 控制工作台：
  - 标题行去重。
  - 分析区改为平台中性表面，在工作台范围内把精品课主题变量映射到平台 token。
  - 学生可见文案去除“Arena”“DB BOPPPS”“商业工作区”等内部用语，并删除与状态栏重复的说明段。

## Capabilities

### New Capabilities

- `interactive-learning-tool-pages`: PID 控制仿真器与控制理论地图的外壳归属、主题 token、预览与记录语义、筛选与搜索交互。

### Modified Capabilities

- `control-workbench-view-configuration`: 新增工作台分析区主题中性化与学习者可见文案要求。

## Impact

- 前端：
  - `src/app/interactive-learning/pid-simulator/page.tsx`、`src/app/interactive-learning/control-map/page.tsx`
  - `src/resources/interactive-learning/pid-simulator/pid-simulator-component.tsx`
  - `src/resources/interactive-learning/control-map/**`
  - `src/features/interactive/interactive-learning-shell.tsx`
  - `src/features/control-workbench/shell/control-workbench-shell.tsx`、`src/features/control-workbench/presets/classic-four-view-preset.tsx`
  - `src/components/platform/platform-ui-contracts.ts`（启动说明文案）
  - `src/app/globals.css`（工作台范围的主题变量映射）
- 治理：`src/lib/platform-appshell-contract.ts` 删除两条遗留演示豁免并扩充 `InteractiveLearningShell` 路由族。
- 不改：PID 对象模型与 Rust 批量仿真接口、工作台快照与稳定裕度逻辑（`add-control-workbench-snapshot-comparison`、`fix-control-workbench-gain-margin-state` 的范围）、精品课全局主题、数据库与运行态内容。
