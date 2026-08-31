## Context

日常 Runtime 选择必须以当前运行应用的实际消费者验证为依据。相同 Runtime 清单在应用镜像或数据库迁移变化后需要重新合格，旧证明仍应保留用于审计。首轮图谱与 Runtime 的协调事务则在停止消费者后执行，不能伪造日常消费者证明。

## Decisions

### 证明以完整内容寻址

证明的 canonical wire SHA-256 同时是文件名和 active receipt 的 proof identity。文件位于受控状态目录，创建时不可覆盖。相同内容幂等复用；任一应用 revision、image digest、迁移集或 Runtime 身份变化都会得到不同文件。

### 生命周期传递精确证明

日常激活将 proof digest 写入 activation journal，并在 v1 active receipt 投影时只读取该摘要对应的文件。崩溃恢复使用 journal 中的同一摘要；已激活身份的无新资格恢复保留既有 active receipt 中的证明，不把历史证明说成新资格。

### 协调迁移例外不扩大为日常路径

日常激活没有 proof digest 即失败。仅已有 coordinated declaration、authorization 与 binding 同时存在，并由外层事务设置 `ACT_RUNTIME_LEGACY_MIGRATION=1` 时，保留原先“消费者保持停止”的协调分支。该分支不生成或声称日常兼容性资格，最终 Authority journal 继续控制回滚与成功封存。

## Non-Goals

- 不重写协调 Authority/图谱事务。
- 不为历史 active 或 rollback Runtime 补造证明。
- 不改变应用或 Runtime 的冻结分支和发布版本规则。
