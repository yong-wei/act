# Zero-caller 与保护面收据

捕获修订：`d4531207086d006f60d4ff8ea21e75410fea78c1`

## 已删除路径（无活跃生产 caller）

| path | 生产/browser/server | 测试/历史 | 处理 |
| --- | --- | --- | --- |
| `analysis/control-engine-server-runtime.ts` | 无 | inventory/R3 清单 | 删除 |
| `analysis/control-analysis.worker.ts` | 非线性分析已改 URL | 分析测试改读 façade worker | 删除 |
| `simulations/rust/control-engine-runtime.ts` | 已改 façade/client | 场景测试改读 façade | 删除 |
| `simulations/rust/control-engine-server-runtime.ts` | 路由/optimizer 已直连 server | pid-evidence 改绑 `server.ts` | 删除 |
| Odyssey client/server runtime wrappers | physics/official-simulation 已直连 | Odyssey 测试保留符号别名 | 删除 |
| `unit-5-5/.../rl-training-runtime.ts` | step-panels 改 `rl-training.ts` | 课程测试改路径 | 删除 |

## 保留

| path | 原因 |
| --- | --- |
| `use-control-engine.ts` | 产品 UI hook，不是 WASM loader |
| `control-analysis-service.ts` | Arena 官方评分权威 |
| `SimulationSession` / `SimulationLog` | 历史 lease / profile / admin |
| generated WASM 包 | runtime identity |
| `src/resources/simulations/destroyer-simulation.tsx` | 历史 spec/test 保护 |

回滚：恢复到捕获修订。不得把已删 TS stepper 与 façade 同时作为数值权威。
