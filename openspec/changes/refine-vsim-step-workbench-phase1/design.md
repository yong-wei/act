## Context

参见 `proposal.md`。现网七艘虚拟仿真实验共享前端 Hook（`use-vessel-experiment.ts`）、评估组件（`model-workbench.tsx`、`dp-model-workbench.tsx`、`vessel-experiment-panels.tsx`）、草图 API（`sketch-recognition.ts`、`sketch-plots.ts`）与前后端一致性校验链路（`*-evidence.ts`、`course-attempt-validation.ts`、`course-artifact-contract.ts`）。后端持久化 `stepDrafts` 与提交校验 `attempt.answers` 均严格限定为扁平 `Record<string, string>`。

## Goals / Non-Goals

**Goals:**
- 以声明式 `vessel-workbench-policy.ts` 集中管控七船各步的评估通道、候选结构、对照模式、级联伺服选择器、专题物理面板与空态前置指引，彻底消除运行期静态回退偏差。
- 将多模态 `SketchPad` 升级为三层架构（SVG 标准工程坐标系底板 + 透明笔迹层 + 独立可控的解析/实测曲线对比层），向视觉模型仅发送坐标底板与学生笔迹，支持「运行前预测手绘 → 实船轨迹比对」和「辨识后解析特征互证」双向教学场景。
- 建立四段式任务简报（目标/步骤/观察/工况）与结构化三段论表单（`StepWorkbenchSpec` + `StepPredictionStage` / `StepObservationStage` / `StepInterpretationStage`），全量升级集装箱船、邮轮、981 平台 60 步，并补齐四船 `prediction` 提交校验与第 16–19 步遗漏控件。

**Non-Goals:**
- 本期不重构 055 驱逐舰、LNG 船、雪龙 2、天鲸号的 80 步文案与三段论结构化表单（保留其现有步序文案与表单逻辑在 Phase 2 实施，但本期立即为其启用分船/分步评估工作台修复与天鲸号轮次补齐）。
- 不修改 Rust/WASM 数值求解器或 Prisma 数据库结构。

## Decisions

- **决策 1：采用基于 `courseKey + stepSequence` 的纯策略真源驱动评估工作台**
  - *Rationale*: 将船型和步序决策从分散在组件内的 JSX 三元表达式收拢到 `vessel-workbench-policy.ts`。无论本地运行记录是否为空或正在异步加载，通道、结构与级联伺服控件均由 `courseKey` 锁定，彻底杜绝回退至 `rudder-to-yaw` /「冻结的舵机模型」。
  - *Alternatives Considered*: 在各 `*-simulation.tsx` 内各自条件渲染简化版工作台。否决原因：会导致七船交互逻辑、公式展示和回归验证碎片化。
- **决策 2：多模态 `SketchPad` 三层分离 + 离屏坐标系合成**
  - *Rationale*: 坐标系底板（刻度、单位、`t=20s/180s` 节点、井口 `1.0m/1.5m/2.5m` 警戒圈等）用轻量矢量渲染供屏幕清晰显示，发送至 `/api/simulations/sketch-review` 前在离屏画布合成为「白底 + 坐标底板 + 学生笔迹」单张 PNG（若运行环境不支持离屏 2D 上下文如 jsdom 测试则平稳降级），Layer 3 解析线与实船真值曲线永远只在覆盖层显示而不进入图像字节流，既让 VLM 真正看懂物理量纲，又严守防剧透隔离契约。
- **决策 3：扁平字符串键 + 可读摘要合成承载多样化三段论表单**
  - *Rationale*: 后端 `cleanDraftValues` 与 `vesselCourseArtifactSchema` 拒绝嵌套对象/数组，且教师复核面板直接读取 `answers` 各键值对并依赖 `answers.prediction`/`answers.observation`/`answers.interpretation`。新组件将单选、排序、多工况槽表、通道配对写入扁平键（如 `predictionChoice`、`predictionTarget`、`obs_slot_<id>_<metric>`），同时实时合成 `readings.prediction` 与 `readings.observation` 摘要，做到数据库、CAS、教师复核与 iLab-X 零迁移全兼容。
- **决策 4：集装箱船第 7–8 步单模型体验与 Rust 三工作点约束兼容**
  - *Rationale*: Rust `ContainerSpeedInput::validate` 硬性要求 `models` 数组为 3 个 `(loading_ratio, speed_mps)` 互不相同的模型。第 7–8 步 UI 改为主打「当前工作点模型」单一主选择框，后台自动按已冻结的不同载荷/航速模型补齐其余两位；若本人冻结的不同工况模型不足 3 个，则展示清晰的前置缺口提示（第 3/5/6 步）而不强塞 3 个重复下拉框误导学生。

## Risks / Trade-offs

- **新增 `answers.prediction` 非空校验对旧测试夹具的影响** → 同步审计并更新所有单元测试夹具（`container-course.test.ts`、`cruise-course.test.ts`、`drilling-course.test.ts`、`lng-evidence.test.ts`、`course-attempt-validation.test.ts`），并补充缺失 `prediction` 的负向断言。
- **现有正则源码测试对 `cruise-simulation.tsx` 的精确子串约束** → 严格保留 `CruiseComfortReadout comfort={state.comfort}`（单行）、`VesselCourseEvidencePanel` 与 `comfort: frame.cruiseComfort ?? null`，确保 `cruise-control-effect-debrief.test.ts` 零退化。
- **单文件行数与两期拆分边界** → 为集装箱船、邮轮、981 平台分别建立独立的 `*-step-specs.ts` 文件（确保单文件低于 500 行），与 Phase 2 其余 4 船保持清晰隔离。
