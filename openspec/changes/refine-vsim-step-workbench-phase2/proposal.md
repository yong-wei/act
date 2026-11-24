## Why

Phase 1 已完成七船共用评估工作台底座、工程坐标系多模态手绘框架、三段论结构化表单底座以及三大核心船（集装箱船、邮轮、981 平台）60 步全量重构。其余四船——055 驱逐舰（`destroyer`）、LNG 运输船（`lng`）、雪龙 2 破冰船（`icebreaker`）与天鲸号绞吸挖泥船（`dredger`）——的 80 步仍沿用旧版同源重复的「本步目标 / 本步要看」与平铺文本框、存在非对应步骤暴露无关控制项（如天鲸号第 9–19 步一次性平铺 13 个控制字段、雪龙 2 平静步暴露滤波下拉、055 驱逐舰尚未接入三段式表单与第 20 步证据胶囊、若干提交校验漏项如 055 缺 `prediction` 与 LNG 第 16 步未校验两条不同风流方案），且邮轮、981 平台及四船的 `clockRef.current.advance` 回调仍需补齐停机子步重入护栏，并完成全 7 船 140 步仿真运行—填写—提交全链路验证。

## What Changes

- **补齐剩余四船 80 步教学简报、结构化三段论表单与坐标手绘能力（055 驱逐舰 / LNG 船 / 雪龙 2 / 天鲸号）**：
  - 为四船分别建设拆分式步骤教学规约（`*-step-specs-early.ts`、`*-step-specs-late.ts`、`*-step-specs.ts`），全面落地四段式任务简报（动词态 `本步目标`、编号 `操作步骤`、定量 `本步重点观察`、纯中文无内部代码 `本步工况`）与多样性 `StepPredictionStage` / `StepObservationStage` / `StepInterpretationStage`。
  - **055 驱逐舰**：扩展 `DestroyerExperimentStep` 与 `DestroyerStepForm`（严格保持 `legacy-v1` 不变），接入运行前结构化预测区、运行中/后曲线拾取与测量窗口联动、第 8 步坐标校准多模态手绘（支持切换图种并叠合 `StudentModel` 解析特征）、第 3/10/12 步预测草图、第 20 步四维量规与证据胶囊（`Step20EvidenceWorkbench`）、补齐滤波与积分抗饱和锁步控制、并在 `validateDestroyerCourseEvidence` 中补齐运行步 `prediction` 校验。
  - **LNG 运输船**：抽出独立按步门控控制组件 `lng-course-controls.tsx`，补齐空模型前置引导、中文友好工况名与第 16 步「至少保存两组不同策略的风流靠泊对比」校验（`lng-evidence.ts`），在关键节点（如第 5/6/13/14 步）挂载带坐标系的预测/频域手绘板与第 12 步三工况装载参数自动提取。
  - **雪龙 2 破冰船**：重写 20 步教学规约，在 `icebreaker-course-controls.tsx` 中收敛非相关步的微分滤波与积分时间控件、用中文工况命名代替 `17`/`29` 数字代号、清除学生文案中残留的内部模型术语、并挂载第 3/8/10/19 步坐标系预测与冰区失配分析手绘板。
  - **天鲸号绞吸挖泥船**：重写 20 步教学规约，彻底重构 `dredger-course-controls.tsx` 实施逐步骤（第 1–19 步）严格控件门控与基线参数锁定（如第 15 步新增静水方案引用、第 19 步引用第 17/18 步方案后锁定参数防覆盖），挂载第 5/13/18 步坐标系手绘板。
- **全七船仿真步进护栏与全 140 步端到端仿真—填写—验收测试**：
  - 为邮轮、981 平台、LNG 船、雪龙 2 与天鲸号统一在 `clockRef.current.advance` 回调首行添加停机重入护栏（并在 `drilling-simulation.tsx` / `lng-simulation.tsx` 对齐 `if (course.running)` RAF 门控）。
  - 新增 `vsim-step-workbench-phase2.test.tsx` 与 `vsim-all-steps-e2e-contract.test.ts`，结合真实 WASM 物理核心覆盖全 7 船 × 20 步 = 140 步的仿真步进、结构化表单填写合成及后端提交校验全通，并在本地开发服务上完成真实 GPU-Chrome Playwright 交互仿真与明暗视觉 QA。

## Capabilities

### New Capabilities
<!-- 无独立新增主规范，增量并入既有规范 -->

### Modified Capabilities
- `vsim-differentiated-teaching-workbench`: 将 Phase 1 建立的四段式任务简报、按步隔离控制面板、多样化“预估—采集—解释”三段论表单、工程坐标系多模态手绘与第 20 步证据胶囊扩展至全七船（补齐 055 驱逐舰、LNG 船、雪龙 2 与天鲸号共 80 步），要求所有 140 步具备完整可运行仿真、可填写表单与有效提交验收。
- `student-model-evaluation`: 明确 055 驱逐舰（步 2/4/7/8/10/20）与天鲸号/LNG/雪龙 2 步序校验、方案锁定与防空模型误导提示要求，保证预测阶段（`prediction`）与对比方案参数一致性在全七船一致生效。

## Impact

- **受影响代码**：`src/resources/simulations/experiments/` 与 `src/resources/simulations/simulations/` 下 055、LNG、雪龙 2、天鲸号步骤规约、控制面板、证据校验与邮轮/981 平台步进回调，以及 `src/resources/simulations/__tests__/` 测试集。
- **兼容性边界**：维持 `legacy-v1` 055 驱逐舰路径向后兼容；维持 `answers: Record<string, string>` 扁平契约与既有 CAS / iLab-X 数据流兼容；不修改 Prisma schema，不改动 Rust/WASM 数值方程。
