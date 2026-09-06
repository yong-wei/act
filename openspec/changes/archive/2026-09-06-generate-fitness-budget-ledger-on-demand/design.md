## Context

`scripts/architecture-fitness.ts` 的 `--write-ledger` 分支已调用 `createFitnessBudgetLedger`，默认检查却重新读取提交版 JSON。当前生成结果与提交文件一致：4,675 条预算记录，6,290,905 字节。另有 65 字节摘要文件。

`scripts/quality-gates/registry.ts` 将 ledger 文件声明为输入；`resource-governance-retirement/frozen-callers.ts` 中存在该文件的历史引用。它们需要区分现用输入与历史记录，而不是要求恢复生成副本。

## Goals / Non-Goals

目标是减少工作树体量和重复读取步骤，使默认检查在没有导出文件时仍可运行。

不修改预算值、allowlist 语义、既有 baseline 和测量输入；不删除 archive 或知识发布文件；不引入新的存储服务、清单、摘要或资格流程。其他旧 CLI 不纳入本项。

## Decisions

1. 默认检查直接复用 `createFitnessBudgetLedger`，传入原有 baseline、allowlist 和测量输入，再交给现有 evaluator。不得改用当前候选指标重设预算，现有输入一致性检查照常保留。
2. 删除两个跟踪文件；现有 `fitness:architecture:write-ledger` 按需输出到已忽略的架构工件目录。默认检查不读缓存，也不写文件。导出调用与帮助文案一起更新。
3. 质量 registry 指向保留的生成输入/实现，并用现有命令刷新 registry JSON；不要再把展开 JSON 列为必需的仓库源文件。
4. 历史 caller 记录不冒充当前活跃引用。仅调整此次生成文件对应的当前扫描/断言；历史证据不批量重写，不能为通过测试恢复大文件。
5. 用现有测试确认重建结果和预算判断，PR 的 diff 统计说明减少量即可，不建立新收益工具。

## Risks / Trade-offs

内存重建增加少量计算 → 现有 evaluator 已有重建一致性逻辑，可合并重复计算，但不得复制生成器。

删除副本可能暴露隐含路径依赖 → 覆盖默认检查、显式导出、quality registry 和 retirement 扫描的定向测试。现有预算超限、缺失输入和输入不匹配仍应失败。
