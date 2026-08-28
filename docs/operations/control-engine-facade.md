# Control Engine facade

状态: active
捕获修订: `653b4a7cd0cedf3e70902411404f0c297cd00901`
提案快照: `a3e6ce7435503050146cadeae6359d6b8eb9a2a5`

## 合同

浏览器、Worker 与服务端共用 `control-engine-facade/v1`。只有

- `src/lib/control-engine/wasm-browser.ts`
- `src/lib/control-engine/wasm-server.ts`

以及 `scripts/wasm/build-control-engine.mjs` 可以触达 generated `control_engine` 包。业务模块必须走 façade。

## 生命周期

请求只能得到 `ready` 数值结果，或 `error` / `timeout` / `unavailable`。WASM 未就绪、超时、非有限输出和残缺 generated 包都 fail closed。禁止 TypeScript 物理或离散化回退。

`useControlEngine` 的 `fallbackResult` 只是展示态：`source=fallback`、`isAuthoritative=false`、`runtimeIdentity=null`。它不得进入 cache、SimulationRun、Arena 评价或证据。

## 权威

| executor | authoritySource | persisted |
| --- | --- | --- |
| browser / worker | `control-engine-*-facade` | false |
| server | `control-engine-server-facade` | 仅 `/api/arena/virtual-simulation-runs` 预览写路径 |
| Arena official evaluator | `arena-official-evaluator` | 官方评分仍由 Arena evaluator 拥有 |

`/api/arena/virtual-simulation-runs` 在任何数值执行前拒收 client `trace` / `summary` / `checksum`。预览由 Rust `arena_cruise_roll_preview` 重算，envelope 为 `modelRelation=surrogate`。

## 生成身份

`scripts/wasm/build-control-engine.mjs` 写出 `.build-hash`、`identity.json` 和 `src/lib/control-engine/identity.generated.ts`。部分文件、手改 JS/WASM 或 hash 不匹配会使 runtime 不可用，不能切换到 TypeScript 实现。

回滚：恢复本 change 之前的 generated 包与 identity 文件。不得删除历史 SimulationRun / Arena 证据。

## 服务端消费者（R3）

四类服务端 consumer 与 virtual-preview 写路径只通过 `@/lib/control-engine/server` 取数值：

| 类别 | 入口 | façade 符号 |
| --- | --- | --- |
| generic analysis | `/api/simulation/runs` | `computeControlAnalysisServer` |
| simulation virtual | cruise/icebreaker routes、optimizer | `computeVirtualSimulationServerStep` |
| Control Odyssey | `official-simulation.ts` | `computeControlOdysseyServerStep` |
| Arena analysis | `ControlAnalysisService` | `computeAnalysisServer` |
| Arena preview persist | `controller-preview.ts` | `computeArenaVirtualPreviewResult` |

清单真源：`src/lib/control-engine/server-consumers.ts`。官方 Arena 评分仍由 evaluator 拥有；缓存最小键仍是 `taskId + artifactHash + protocolVersion`。命中后还须核对写入 metadata 的 runtime/model/spec 绑定，冲突视为 miss，不得把旧分数当成新 runtime 的官方结果。三个 server compatibility loader 留给 R6 删除，本阶段不得删除。

隐藏输入与 client `trace`/`summary`/`checksum` 仍在 façade 外被拒绝。facade `unavailable`/`timeout` 不得写成 SimulationRun 或官方分数。
