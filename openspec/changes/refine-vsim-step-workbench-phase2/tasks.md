## Wave 1：公共仿真步进护栏与 055 驱逐舰（20 步）升级

- [x] 1.1 在 `cruise-simulation.tsx`、`drilling-simulation.tsx`、`lng-simulation.tsx`、`icebreaker-simulation.tsx` 与 `dredger-simulation.tsx` 的 `clockRef.current.advance` 回调中统一补齐 `if (!course.running) return;` 及 RAF 门控护栏。
- [x] 1.2 新建 `destroyer-step-specs-early.ts`、`destroyer-step-specs-late.ts`、`destroyer-step-specs.ts`，为 055 驱逐舰 20 步编写四段式简报、三段论结构化表单及第 3/8/10/12 步工程坐标系多模态手绘。
- [x] 1.3 升级 `destroyer-experiment.ts`、`destroyer-experiment-panels.tsx`、`destroyer-simulation.tsx` 与 `destroyer-evidence.ts`，接入 `StepPredictionStage` / `StepObservationStage` / `StepInterpretationStage`、`Step20EvidenceWorkbench`、第 8 步 `StudentModel` 叠加、`derivativeFilterTauS`/抗饱和锁定以及运行步 `prediction` 校验（保持 `legacy-v1` 不变）。

## Wave 2：LNG / 雪龙 2 / 天鲸号（60 步）重构与控板门控

- [x] 2.1 新建 `lng-step-specs-{early,late}.ts`、`lng-step-specs.ts` 与 `lng-course-controls.tsx`，升级 `lng-experiment.ts`、`lng-simulation.tsx` 与 `lng-evidence.ts`（含第 16 步双方案差异校验与第 5/6/13/14 步多模态坐标系手绘）。
- [x] 2.2 新建 `icebreaker-step-specs-{early,late}.ts`、`icebreaker-step-specs.ts`，升级 `icebreaker-experiment.ts` 与 `icebreaker-course-controls.tsx`（收敛滤波与积分控件、中文未见工况说明、清除内部代号及第 3/8/10/19 步坐标系手绘）。
- [x] 2.3 新建 `dredger-step-specs-{early,late}.ts`、`dredger-step-specs.ts`，升级 `dredger-experiment.ts` 与 `dredger-course-controls.tsx`（第 1–19 步逐步骤精确控板门控与第 15 步静水方案引用、第 19 步方案锁定及第 5/13/18 步坐标系手绘）。

## Wave 3：全 140 步仿真—填写验证、静态门禁与部署

- [x] 3.1 更新 `destroyer-evidence.test.ts` / `lng-evidence.test.ts` 并新增 `vsim-step-workbench-phase2.test.tsx` 与 `vsim-all-steps-e2e-contract.test.ts`，在真实 WASM 会话上验证全 7 船 140 步仿真可运行、表单可填写、校验全通过。
- [x] 3.2 依次通过 Vitest 仿真与治理全集、ESLint `--max-warnings=0`、`NODE_OPTIONS="--max-old-space-size=8192" typecheck` 及 `openspec validate --strict`。
- [x] 3.3 在 `http://localhost:3011` 完成 GPU-Chrome Playwright 7 船真实交互仿真与表单提交验收及明暗双主题截图视觉核查。
- [x] 3.4 完成 `integration` 提交合并至 `main` 并升级发布版本号、完成阿里云与校内（网络可达范围内）镜像构建、推送与运行态验收，清理收尾释放 Docker 内存。
