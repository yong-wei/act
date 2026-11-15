## Why

2026 年度教育部“人工智能+”虚拟仿真实验教学项目在线申报对“实验原理与三层隔离机制可视化、人工智能原生伴学、产教融合工业硬约束、iLab-X 与 `ai_data` 合规回传”提出了直接可核验的要求。当前 `act` 底层已具备 Rust 六自由度真值—观测—学生模型三层引擎、水动力参数包与服务端证据链基础（由 `#2159`/`#2160`/`#2161` 及 `stabilize-ilab-simulation-experience` 推进三核心船主流程接线），但在前端沉浸交互层面仍需把底层硬核机理外化为评委与学生首屏立即可见的教学体验，形成“人无我有、人有我优”的差异化竞争优势。

## What Changes

在严格遵守 `simulation-scene-shell-architecture`（中央 3D 视景优先、左右可折叠玻璃面板、顶部任务追踪、底部工具栏、单一右下角控灵入口、浅暗双主题适配，且不新增顶部右上角角色切换器）的前提下，面向邮轮、集装箱船、981 平台三大核心实验及共用实验台引入以下“人无我有，人有我优”增强能力：

1. **三层受控模型隔离同屏拓扑与模型失配阴影带（Truth-Observer-StudentModel Live Topology & Mismatch Band）**：
   - 在左侧“状态”与对照曲线面板展示 `TruthPlant（真值物理黑盒）➔ Observer（噪声/滤波/故障）➔ StudentModel（本人冻结模型）` 实时状态流指示，并将真值/观测/学生预测三线同屏叠绘，自动填充 `|Truth - StudentModel|` 残差阴影带与“线性假设失配区（RMSE 超阈值）”原位诊断提示。
2. **曲线异常拐点原位问控灵与步 19 手绘理论特征叠合（Curve Anomaly Konling Trigger & Sketch Analytical Overlay）**：
   - 当仿真曲线出现超调峰值、舵/鳍饱和削顶、推进器调制高频振荡或 `t=180s` 突发故障跳变时，在图表异常拐点处提供一键触发按钮，自动携带当前步序、物理量拐点快照与“苏格拉底防代写护栏（屏蔽标准整定参数直出）”上下文徽标，呼出并聚焦平台唯一共享控灵入口。
   - 在第 19 步手绘视觉识别返回后，支持在画板上叠加根据本人已冻结 `StudentModel` 解析计算出的理论特征基准线（伯德图渐近线/转折频率、根轨迹渐近线与极点位置、或时域包络），实现“手绘直觉 ↔ Qwen-VL 识别 ↔ 本人辨识模型解析解”跨模态互证。
3. **三大核心船工业多目标权衡仪表与海工红黄警戒包络（Industrial Multi-Objective Trade-off HUD & Offshore Envelope）**：
   - 大型邮轮：在右侧评估/状态区并列可视化晕船率 MSI 仪表、减摇鳍高频磨损积分/连续失速告警灯，并在 3D 视景提供可开关的吊舱偏角与减摇鳍升力矢量叠加。
   - 集装箱船：在 6000m 四航段流场旁新增“ETA 900s 准点偏差 ↔ SFOC 立方累积油耗”双轴天平与满舵掉速提示。
   - 981 钻井平台：在 3D 海面围绕海底井口绘制绿（≤1.0m）/黄（1.5m）/红（2.5m 紧急解脱）同心警戒圈，在 8 推力矢量雷达图上直接绘出相邻立柱尾流禁用扇区与全船 32MW 总功率封顶条，并在 `T2` 断桨时原位高亮 2 号推进器失效喷流柱与重分配向量。
4. **可交互“预估—操作—解释”微闭环与步 20 实测证据胶囊（Prediction Target, Curve Picking & Report Evidence Capsules）**：
   - 步骤 1–18 预估提交后，学生预估目标在空白坐标轴渲染为黄色虚线靶标；运行仿真后支持点击曲线特征点一键拾取带时间戳的实测读数填入表单。
   - 步骤 20 六段式工程报告编辑器旁列出本人在步 1–19 冻结的模型、并跑 RMSE 与 `t=180s` 故障处置卡片，支持一键插入带签名的实测证据胶囊，并按 AI 量规四维（模型假设/实证绑定/方案比较/安全边界）对齐高亮反馈。
5. **iLab-X 与 `ai_data` 审计实时透视镜及专家高光导览模式（Telemetry Inspector & Evaluator Highlight Tour）**：
   - 在顶部任务追踪器的实验空间状态标识旁增加可展开的实时审计抽屉，脱敏展示 `originId`、20Hz 采样分块进度、模型哈希以及当前 `ai_data`（调用模型、版本、场景、输入/输出 Token）回传报文预览。
   - 在仿真目录与工作台顶部任务条内提供合规的“典型高光工况导览”入口（不更改普通学生 20 步顺序解锁规则，不占用右上角 AppShell 角色区），允许评审专家与访客一键预览 5 个核心高光教学节点并载入基准示范证据只读交互或对比验真。

## Capabilities

### New Capabilities
- `vsim-differentiated-teaching-workbench`: 三层隔离同屏失配可视、曲线拐点问控灵与步 19 解析叠合、三大核心船工业权衡与 3D 力场警戒包络、预估靶标与曲线拾取、步 20 证据胶囊，以及 iLab-X/`ai_data` 审计透视与专家高光导览体验。

### Modified Capabilities
- （无：本变更严格遵循既有 `simulation-scene-shell-architecture` 边界并通过新增能力扩展工作台交互与可视化，不破坏既有壳层与评价契约。）

## Impact

- 涉及组件与模块：
  - 仿真外壳与任务工作台：`src/resources/simulations/simulations/vessel-experiment-panels.tsx`、`src/resources/simulations/components/simulation-ui.tsx`、`src/resources/simulations/simulations/sketch-pad.tsx`、`src/resources/simulations/simulations/use-vessel-experiment.ts`
  - 对比曲线与辨识工作台：`ModelComparisonCurve` / `VesselModelWorkbench` / `DpModelWorkbench`（随三船专项合入后在 `vessel-experiment-panels.tsx` 与 `dp-model-workbench.tsx` 所在组件对齐）
  - 三大核心船 3D 视景与状态面板：`cruise-simulation.tsx` / `cruise/`、`container-simulation.tsx`、`drilling-simulation.tsx`
  - AI、手绘与 iLab-X 回传审计：`src/features/ilab/ai-data.ts`、`src/features/ilab/sketch-recognition.ts`、`src/features/ilab/sketch-plots.ts`、`src/components/ai/global-ai-sidebar.tsx`、`src/features/simulations/course-report.ts`
- 执行依赖关系：本 Issue 在三核心船专项改动（`#2159`、`#2160`、`#2161`）完成后进入实施，不修改后台物理数值核心与既有学生评分容差。
