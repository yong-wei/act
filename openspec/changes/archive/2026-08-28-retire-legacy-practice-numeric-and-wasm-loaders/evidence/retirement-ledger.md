# R6 退役台账（捕获修订 `d4531207086d006f60d4ff8ea21e75410fea78c1`）

回滚点：`d4531207086d006f60d4ff8ea21e75410fea78c1`（本 change 实现前的干净树）。删除 commit 可单独 revert；回滚只恢复旧文件，不得同时恢复 TypeScript 数值权威。

## 1. 九个 raw business loader

| id | path | 分类 | 状态 | replacement | 删除条件 |
| --- | --- | --- | --- | --- | --- |
| generic-analysis-hook | `src/resources/control-system/analysis/use-control-engine.ts` | product UI | retained-product-ui | `computeAnalysisBrowser` | Workbench 不再经由此 hook |
| generic-analysis-worker | `src/resources/control-system/analysis/control-analysis.worker.ts` | compatibility | deleted | `src/lib/control-engine/analysis.worker.ts` | 非线性分析 worker URL 已改到 façade worker |
| generic-analysis-server | `src/resources/control-system/analysis/control-engine-server-runtime.ts` | server wrapper | deleted | `computeControlAnalysisServer` | 零生产 caller；第一刀 |
| simulation-client | `src/resources/simulations/rust/control-engine-runtime.ts` | client wrapper | deleted | `computeVirtualSimulationStepBrowserSync` | façade / 场景已直连 client |
| simulation-server | `src/resources/simulations/rust/control-engine-server-runtime.ts` | server wrapper | deleted | `computeVirtualSimulationServerStep` | 路由与 optimizer 已直连 server |
| control-odyssey-client | `.../control-odyssey/engine/control-engine-runtime.ts` | client wrapper | deleted | `computeSimulationStepBrowserSync` | physics / GameCanvas 已直连 client |
| control-odyssey-server | `.../control-odyssey/engine/control-engine-server-runtime.ts` | server wrapper | deleted | `computeControlOdysseyServerStep` | official-simulation 已直连 server |
| arena-analysis-service | `src/features/arena/evaluation/control-analysis-service.ts` | Arena 权威 | retained-arena-authority | `computeAnalysisServer` | 官方评分/有效性仍由 Arena 拥有 |
| unit-5-5-rl-training | `.../rl-training-runtime.ts` | 业务 loader | deleted | `computeRlTrainingBrowser` | 类型与调用迁到 `rl-training.ts` |

## 2. TypeScript 数值步进

已从原模块删除 live stepper：`pidControl`、`smithPredictorControl`、`allocateThrust`、`sloshingStep`、`windLoadStep`、`iceBreakingStep`、`notchFilterStep`、`dpControl`、`dpControlWithFeedforward`、`pidControl2ndOrder`、`updateCurrentEnvironment`、`updateWindEnvironment`、`computeTotalEnvironmentalForces`、`computeDredgingDisturbance`、`azipodCourseKeeperControl`、`dpDecoupledControl`、`finStabilizerStep` 等。页面与 `engine-factory` 继续走 `simulation-engine-facade` 的 WASM 封装。保留 create/metrics/Bode/告警/增益调度插值。

## 3. `SimulationSession` / `SimulationLog`

只审计、不删除。Writer/reader 仍包括 Control Odyssey lease、profile/admin/data-governance、`scripts/db`。未来独立 migration 才能动表。

## 4. Generated artifacts

`index.js` / `index.d.ts` / `index_bg.wasm` / `.d.ts` / `.build-hash` 与 `scripts/wasm/build-control-engine.mjs` 保留。生成模块 import 仅允许 `wasm-browser.ts`、`wasm-server.ts`。

## 5. 保护项

`src/resources/simulations/destroyer-simulation.tsx`：`protected-not-delete`。实际路由使用 `src/resources/simulations/simulations/destroyer-simulation.tsx`。
