## Context

参见 `proposal.md` 的背景动机。`origin/integration` 与当前正在推进的三核心船主线重构（`#2159` 集装箱船、`#2160` 邮轮、`#2161` 981 平台及 `stabilize-ilab-simulation-experience`）已完成 Rust 物理引擎与服务端 `SimulationRun`/`StudentModelArtifact`/`ComparisonArtifact`/`StepSubmissionAttempt`/`ai_data` 接口基座。本项目必须严格遵循 `openspec/specs/simulation-scene-shell-architecture/spec.md` 定义的壳层与浅暗主题规范，在不改变物理内核计算与既有学生容差规则的前提下，把底层能力转化为高辨识度的前端教学与评测交互体验。

## Goals / Non-Goals

**Goals:**
- 在现有左右可折叠玻璃面板（`SimulationDock`）、中央 3D 视景、`SimulationMissionTracker`、`SketchPad` 及共享 `GlobalAiSidebar` 内完成全部 8 项差异化能力增强。
- 对外显化三层隔离架构、曲线异常驱动的 AI 伴学、三大船工业多目标冲突仪表与 `iLab-X`/`ai_data` 审计可信度，支撑在线评审专家在短时间内完整验真。
- 所有新增 HUD 面板、曲线图层、矢量标牌与高亮色块支持浅色与深色两套平台主题对比度标准。

**Non-Goals:**
- 不在 AppShell 右上角增加角色切换器（遵守 `simulation-scene-shell-architecture` 约束）。
- 不新增第二套 AI 对话侧栏，所有“问控灵”触点均路由至唯一的右下角共享控灵入口。
- 不修改 Rust 六自由度真实物理方程、120Hz 积分步长或冻结的 `[3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,6,6,6,10]` 步序满分权重。
- 不在本轮引入复杂全频带实时求解或额外公有云敏感字段透传。

## Decisions

### Decision 1: 复用现有图表与 Dock 结构承载“三层拓扑、靶标线与残差阴影带”
- **方案选择**：在已有曲线对比组件（如 `VesselCurve` 及三船专项合并后的 `ModelComparisonCurve`）与 `VesselExperimentDocks` 左侧 `状态` 页签顶部增加紧凑信号流拓扑条与 Chart.js 扩展图层（`fill: '-1'` 残差填充区、Annotation/自定义插件绘制预估黄色虚线靶标及特征点拾取十字游标）。
- **备选与权衡**：曾考虑在 3D 画布外侧新增第三栏独立面板；因违背“场景优先两翼可折叠面板”契约且会挤压三维视景面积，予以否决。

### Decision 2: 曲线拐点“问控灵”通过统一上下文事件桥驱动现有共享入口
- **方案选择**：在 `use-vessel-experiment.ts` 与通用控灵上下文桥之间扩展轻量 `konlingAnomalyTrigger` 载荷，包含 `{ shipKey, stepSeq, sampleTimeS, peakOrFaultLabel, metricSnapshot }`。点击曲线异常胶囊后打开共享控灵面板，并在提问框上方展示只读物理上下文快照 + “苏格拉底防代写护栏”状态条；消息请求仍走既有 `/api/ai/chat`（并纳入 `ai-data.ts` 台账）。
- **备选与权衡**：避免再建独立弹窗聊天器，既减少状态分裂，又自动继承实验空间账号与 Token 审计链路。

### Decision 3: 第 19 步手绘跨模态叠合采用前端解析特征线 + `Qwen2.5-VL` 结论并置
- **方案选择**：保留 `src/features/ilab/sketch-recognition.ts` 的 `recognizeSketch` 视觉识别协议与纯白/深色手绘板提交数据；在 `sketch-pad.tsx` 上方叠加独立只读 SVG 辅助图层（仅当用户显式切换“叠加本人冻结模型参考特征”时渲染，不会污染提交给 `Qwen2.5-VL` 的学生手绘 PNG 字节）。理论特征线由当前会话已冻结 `StudentModelArtifact` 传递函数/状态空间参数直接解析求得，不调用外部 LLM 计算。
- **备选与权衡**：直接把辅助线画入上传给视觉模型的 Canvas 会导致 AI 把平台辅助线误判为学生笔迹；分离 Canvas 提交层与只读 SVG 叠加层可彻底规避。

### Decision 4: 三船工业多目标 HUD 与 3D 安全包络按船型局部挂接、按壳层原语着色
- **方案选择**：
  - 邮轮（`cruise-simulation.tsx` / `cruise/`）：右侧评估/状态区域嵌入 MSI + 减摇鳍累积高频作动功耗条；3D 组内增加可切换的 `ForceVectorGroup`（双吊舱推进矢量与双鳍升力锥，冻结时变警示红）。
  - 集装箱船（`container-simulation.tsx`）：在 6000m 四航段进度视图集成 ETA 900s 预计偏差 vs 累计燃油立方刻度天平与 35° 舵饱和图标。
  - 981 平台（`drilling-simulation.tsx`）：3D 海底井口上方水面处增加三个半透明环形警戒圈 mesh（`r = 1.0m / 1.5m / 2.5m`）；右侧 `DpModelWorkbench` 旁扩充 8 推进器矢量雷达 SVG（叠加立柱尾流禁区扇形阴影 + `32 MW` 全船电网总功率上限进度条）；`T2` 断桨后 2 号推进器射流消失并显示故障标识。
- **备选与权衡**：3D 矢量与警戒圈默认保持轻量化线框/半透明材质并提供底栏开关，保证笔记本 GPU 下帧率稳态 60 FPS。

### Decision 5: 专家高光导览态与学生正式考核态数据严格隔离
- **方案选择**：在 `SimulationMissionTracker` 附近及 `/simulations` 入口处提供“典型高光工况导览”模式开关。开启导览态后，前端切换至只读/沙盒演示上下文（标明“导览体验模式 · 不覆盖正式成绩与回传”），允许无解锁阻拦地切至 5 个高光步序并一键加载脱敏示范运行样本；退出导览即恢复当前 `IlabExperimentRun` 真源进度。
- **备选与权衡**：若直接对普通访客放开步 1–20 全解锁，会模糊正式学习与演示模式的评估边界；采用明确的状态隔离旗标可同时满足网评体验与教学防刷分严谨性。

### Decision 6: `iLab-X` 与 `ai_data` 审计透视镜全量读取既有服务端账本
- **方案选择**：审计抽屉直接绑定当前实验会话的 `IlabExperimentRun` 状态及 `src/features/ilab/ai-data.ts` 返回的 `IlabAiData` 结构体字段（`ai_call_count`、`ai_models_used`、`ai_usage_scenarios`、`ai_input_token_count`、`ai_output_token_count`、`ai_remark`）并脱敏隐藏密钥与内部 Token。

## Risks / Trade-offs

- **[与 `#2159`/`#2160`/`#2161` 合并冲突风险]** → 本变更已通过 GitHub `blockedBy` 显式依赖 `#2159`/`#2160`/`#2161`，约定在三核心船 20 步与 `ModelComparisonCurve`/`course-report` 基座合并后再认领实施。
- **[Canvas 高频刷新下 3D 矢量与阴影带引发性能回落]** → 曲线残差带采用降采样（≤1000 点）静帧重绘，3D 力场箭头复用共享几何体实例并提供底栏开关控制。
- **[导览模式误触发正式回传风险]** → 在 `VesselStepForm`、`submitStep` 与 iLab-X 回传请求发送层增加显式守卫：导览示范态严格禁止调用正式提交与成绩回传接口。
