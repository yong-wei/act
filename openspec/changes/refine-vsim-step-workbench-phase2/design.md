## Context

Phase 1 已落地共享底座（`vessel-workbench-policy.ts`、`workbench-state-cache.ts`、`sketch-coordinate-templates.ts`、`vessel-step-structured-fields.tsx`、`ExperimentStepAreas` 四段式简报）及核心三船（集装箱船、邮轮、981 平台）60 步重构。Phase 2 需要以零回归方式完成剩余四船（055 驱逐舰、LNG 船、雪龙 2、天鲸号）共 80 步的全量升级，并构建覆盖全 7 船 × 20 步 = 140 步的真实内核端到端仿真填写与验收门禁。

## Goals / Non-Goals

**Goals:**
- 以独立模块化 `*-step-specs-{early,late}.ts` + `*-step-specs.ts` 方式完成 055、LNG、雪龙 2、天鲸号全部 80 步教学规约，确保四段式简报清晰、目标与观察严格分离、学生可见文案零内部缩写与实现术语。
- 为 055 驱逐舰补齐结构化三段论表单、`Step20EvidenceWorkbench`、预测期校验及控制锁定；同时保持 `legacy-v1` 兼容分支完整无损。
- 为 LNG、雪龙 2、天鲸号实施严格按步控件收敛、中文友好的未见工况提示及关键节点的工程坐标系多模态手绘（配合实际运行曲线/解析模型叠合）。
- 修复其余各船仿真动画步进重入漏洞并完成全 140 步真实 WASM 仿真—填写—校验合约测试及 GPU-Chrome 浏览器交互验收。

**Non-Goals:**
- 不修改 `SimulationDock` 标签栏与核心交互（保留 `simulation-scene-drive-chain.test.ts` 不变量）。
- 不修改 `prisma/schema.prisma`，不重新编译 Rust/WASM 核心二进制。

## Decisions

- **决策 1：055 驱逐舰按 `step.courseDefinition` 渐进接入结构化三段论与步 20 证据台**
  - *Rationale*: `destroyer-simulation.tsx` 同时服务历史 `legacy-v1` 与新版 `VESSEL_COURSE_VERSION` 20 步。扩展 `DestroyerExperimentStep` 与 `DestroyerStepForm` 时仅对存在 `courseDefinition` 的课程步骤启用 `StepPredictionStage` / `StepObservationStage` / `StepInterpretationStage`、`Step20EvidenceWorkbench` 与坐标校准 `SketchPad`，`!step.courseDefinition` 完全走既有逻辑。第 2 步保留固有 6 个精确量测字段与 `MeasurementWindow` 联动，其余运行步采用结构化观察面板，并令 `submitStep` 与 `validateDestroyerCourseEvidence` 同步校核所有 `fields` 与 `answers.prediction`。
- **决策 2：LNG 控制面板独立组件化 + 天鲸号/雪龙 2 声明式步序控件门控**
  - *Rationale*: `lng-simulation.tsx` 目前 787 行且内嵌 `ControlPanel`，抽出 `lng-course-controls.tsx` 使页面与控制器职责清晰且单文件 `< 500` 行；天鲸号 `dredger-course-controls.tsx` 将原本第 9–19 步一次性平铺的 13 个参数改为按当前实验目标精准显示/锁定（如第 19 步锁定第 17/18 步已保存方案只选未见土层工况），防止误改基线导致 `controller(run) !== controller(source)` 校验失败。
- **决策 3：全 7 船 × 20 步 = 140 步真内核闭环测试验证可仿真、可填写、可通过验收**
  - *Rationale*: 仅测结构化配置存在或单一示例步骤不足以排除步序事件边界（如时长过短、控制模型参数错配、提交缺字段）导致的卡步 bug。新增 `vsim-all-steps-e2e-contract.test.ts` 调用真实 `createServerVesselSession` 与各船 `validate*Evidence`，确保全部 140 步从物理初始化、事件激励、表单摘要合成到后台核验均端到端畅通。

## Risks / Trade-offs

- **`validateDestroyerCourseEvidence` 补充 `prediction` 校验对旧单测的影响** → 同步检查 `destroyer-evidence.test.ts` 及 `course-attempt-validation.test.ts`，在合规夹具中补齐 `prediction` 字段并增加缺失 `prediction` 的拦截断言。
- **4 个并行子代理同时改动易引发共享类型或 `typecheck` 冲突** → 主线程预先确认共享契约（`vessel-experiment.ts`、`step20-evidence-workbench.tsx`、`destroyer-experiment.ts` 等接口边界）保持向后兼容，按船分配严格互不重叠的文件包，完成后由主线程统一串行运行 Vitest、ESLint 与 `typecheck`。
