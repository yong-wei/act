## Phase 1：底座统一、全七船评估修复与多模态草图升级

- [x] 1.1 扩展 `src/features/ilab/sketch-plots.ts`、`src/features/ilab/sketch-recognition.ts` 与 `src/app/api/simulations/sketch-review/route.ts`，支持 6 类工程图种、实验上下文透传与苏格拉底启发反馈。
- [x] 1.2 新建 `src/resources/simulations/experiments/sketch-coordinate-templates.ts` 并升级 `sketch-analytical-overlay.ts`、`sketch-pad.tsx`，实现 SVG 工程坐标系底板、撤销/对比双笔、纯画布离屏合成传图、以及预测后叠加真实运行曲线比对（支持 `frequency-amplitude` 等模板）。
- [x] 1.3 新建 `src/resources/simulations/experiments/vessel-workbench-policy.ts`，覆盖 7 种船型的步序通道、结构、对照模式、级联伺服（仅 055 舵机 / 雪龙 2 吊舱伺服）、专题评价与空态前置指引，彻底重构 `model-workbench.tsx` 与 `dp-model-workbench.tsx`。
- [x] 1.4 扩展 `src/resources/simulations/simulations/vessel-experiment.ts`、`simulation-ui.tsx`，新建 `vessel-step-structured-fields.tsx` 并升级 `vessel-experiment-panels.tsx`，落地四段式任务简报、置于控制前的预估区、多形态三段论组件、声明式 `SketchPad` 与 `VesselCourseEvidencePanel(courseKey, stepSequence)`。

## Phase 1：核心三船 60 步重构与七船接入/校验补齐

- [x] 2.1 完成集装箱船（Container）20 步教学规约（`container-step-specs.ts`）、按步锁定控制与补回第 17–18 步 `filterTauS`、第 7–8 步单模型主选聚焦、移除双栏重复天平并修复评估卡指标与 `prediction` 校验。
- [x] 2.2 完成邮轮（Cruise）20 步教学规约（`cruise-step-specs.ts`）、按步锁定控制与 `CruiseRollDesign` 传递真实 `notch`、补齐第 2/6/8/19 步多模态坐标系手绘与 `prediction` 校验。
- [x] 2.3 完成 981 半潜平台（Drilling）20 步教学规约（`drilling-step-specs.ts`）、移除空壳与多余下拉框、同步第 11 步基线与第 19 步 `powerBudgetMw` 锁定、补齐第 5/15 步预测草图与 `prediction` 校验。
- [x] 2.4 统一 055 驱逐舰、LNG 船、雪龙 2、天鲸号评估面板接入与轮次/导览门禁，补齐 LNG 第 16 步静水方案引用与 `prediction` 校验。

## Phase 1：验证与视觉验收

- [x] 3.1 更新并扩充既有单测与新增 `vsim-step-workbench-phase1.test.tsx`，覆盖 7 船空列表防舵机/舵角泄漏、多模态坐标系与防污染流、结构化表单、校验门控及核心 60 步文案无内部代码泄漏检查。
- [x] 3.2 运行 Vitest 全相关测试集、ESLint `--max-warnings=0`、`typecheck` 与 `openspec validate --strict`。
- [x] 3.3 使用 Playwright / Browser 验证核心三船及 LNG/雪龙 2/天鲸号在明暗双主题下的实际渲染、无控制台错误与清晰视觉层次。
