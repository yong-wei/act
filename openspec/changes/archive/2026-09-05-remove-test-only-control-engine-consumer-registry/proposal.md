## Why

Control Engine 生产调用已经直接使用 server façade，但 `server-consumers.ts` 仍维护一份只供源码扫描测试读取的手写登记表，其中还包含空的退役候选数组。它增加维护成本，却不参与任何数值执行。

## What Changes

- 删除 `server-consumers.ts`、仅验证该登记表和旧路径的测试，以及 index 中对应的导出。
- 删除运维文档中过期的“清单真源”和“等待 R6 删除”描述。
- 复用现有 façade 导入约束和数值/路由行为测试，不再增加登记表或测试框架。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `server-control-engine-consumers`：明确消费者约束由实际调用与行为测试保证，不保留无运行时用途的测试登记表。

## Impact

删除两个文件、收回 `src/lib/control-engine/index.ts` 的无调用导出，并修改 `docs/operations/control-engine-facade.md`。现有 server façade、生产调用者、Practice 退役 inventory、Rust 和 Arena 评分保持不变。
