# Capability-level rollback

回滚单位是 capability，不是恢复 TypeScript 数值回退。

| capability | 不安全时的行为 | 完整回退 |
| --- | --- | --- |
| `computeArenaVirtualPreview` | 预览 `unavailable`；不写成功 `ArenaVirtualSimulationRun` | 回滚到迁移前完整 commit，并停止新的 preview evidence |
| `computeAnalysis` 白箱预览 | pid/serial-compensator 预览 `unavailable` | 同上；不得改回 `template-preview` |
| 未登记 method | 保持 `unavailable` | 不新增 TS 数学 |

generated WASM 包或 `.build-hash` 不完整时，facade fail closed。本 change 不引入 Prisma migration、评分/榜单规则、历史预览重算、生产部署或生产 selector 变更。
