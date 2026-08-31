# Proposal: Gate candidate path diversity and coverage

## Why

路径规划已要求候选有实际差异，但仍可能把只改标题、说明或分数的伪候选当作不同方案。这会削弱路径区分度，也让决策证据链和效果评估失去可靠比较对象。

## What Changes

- 用服务端候选事实计算确定性差异：节点身份/顺序、可个性化资源组合、节奏/工作量、检查点与终结验证。
- 仅文案或分数差异不得形成新候选；共享强制先修和终结验证节点不视为缺乏差异。
- 不满足门槛时减少候选数量并记录限制原因，不伪造路径凑数。
- 差异结论不依赖客户端排序，不改写已保存路径。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `adaptive-path-candidate-batches`: 候选批次只持久化通过差异与资源覆盖门禁的可执行方案。

## Impact

- `src/lib/adaptive-path-candidate-batches.ts` 及候选批次测试
- 不重写路径评分，不引入强化学习或系统排名
