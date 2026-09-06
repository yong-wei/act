## Why

`docs/architecture/fitness-budget-ledger.json` 是 6.29 MB 的生成展开表，现有 `createFitnessBudgetLedger` 已能从保留的输入完整重建。日常检查没有必要依赖一份额外提交的展开副本。

## What Changes

- 架构预算检查直接使用现有生成函数的内存结果，删除 Git 中的 ledger JSON 和配套摘要文件。
- 保留现有显式导出命令，生成结果改放忽略目录；同步命令说明和质量检查输入描述。
- 更新相关测试和扫描器，去掉对生成副本必须被 Git 跟踪的假设。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `establish-architecture-fitness-budgets`: 预算展开结果按需生成，不再要求 Git 保存副本，预算与失败判断保持。

## Impact

涉及 `scripts/architecture-fitness.ts`、`src/lib/architecture-fitness/budgets.ts`、相关测试、质量检查 registry、文档与精确 ignore 规则。删除约 6.29 MB 跟踪文件，不引入依赖或外部存储。
