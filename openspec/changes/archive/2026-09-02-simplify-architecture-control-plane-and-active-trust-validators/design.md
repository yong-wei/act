## Context

ACT 已经有 architecture census、charter/deprecation ledger、domain dependency contract、fitness budget、TypeScript graph、quality/toolchain receipt、QA lifecycle 和 runtime/release compatibility proof。它们各自拥有事实；问题是跨层 wrapper 可能重复读取、归一化和投影 status。C35 使用 C34 inventory 确定 active path，只简化重复控制逻辑，不将不同 authority 合并成一个无法审计的万能 validator。

## Goals / Non-Goals

**Goals:**

- 让每类控制事实只有一个 producer/validator owner，并通过明确 receipt contract 供上层消费。
- 统一 source/tree/schema/denominator/identity/privacy/status 的校验顺序，保持失败关闭。
- 删除无独立事实的 alias、wrapper、重复 normalization 和 parallel trust projection。
- 固定 release/rollback 唯一安全 validator 与其他观察性检查的权限边界。

**Non-Goals:**

- 不重建 census、charter、dependency、fitness、quality、toolchain、QA 或 release domain。
- 不把所有检查合成一个巨型 validator，不创建第二套门禁、shell、receipt store 或 command dispatcher。
- 不改变 `verify:commit`、`verify:push`、`typecheck`、production graph、PlatformSetting、业务 owner 或生产 selector。
- 不以简化为由放宽 dirty/mixed/drift、privacy、source identity、denominator、authorization 或 rollback safety。

## Before / After

### Before

- 多个脚本和 library wrapper 对 receipt、source identity、owner/status、privacy 和失败状态做相似但不完全一致的检查。
- architecture/quality/toolchain/release checks 的结果有时通过 alias 或 package wrapper 二次投影，难以辨认哪个结论具有安全 authority。
- active trust validators 与观察性 fitness/quality evidence 的调用关系依赖命令路径和历史约定。

### After

- census、charter/deprecation、dependency/fitness、quality/toolchain、QA 和 release trust 各自保留唯一 producer/validator；共享规范化只在已有 control-plane owner 内复用。
- 每个 active command 通过 C34 canonical mapping 直接调用对应 validator，receipt/status 不再重复猜测或覆盖。
- release/rollback 的唯一安全 validator 明确拥有 selector/deployment safety decision；其他 checks 只提供输入 evidence，不能授权变更。

## Decisions

### 1. Preserve authority-specific validators

不要把 specialized validators 合并成一个新中心。保留现有 census、charter、fitness、quality/toolchain、QA 和 release compatibility 的边界；只删除无独立事实的重复校验和 alias。跨层 aggregate 只能消费已绑定 identity 的 receipts。

### 2. Make identity and denominator checks shared but singular

若已有 control-plane owner 提供 canonical identity/denominator/privacy helper，则由它统一调用；否则在对应 owner 内补最小纯 helper。所有 check 必须验证 source commit/tree、schema/version、scope、owner、receipt identity 和 totals，缺失/冲突/stale 产生 unresolved/blocked，不能默认为 pass。

### 3. Keep trust security separate from observations

release/rollback unique security validator 是唯一能够判断 selector/deployment safety 的 owner。architecture fitness、toolchain、quality、QA 和 closure reports 即使 qualified，也只是其声明 scope 的 evidence；它们不能旁路 security validator、修改 selector 或触发生产操作。

### 4. Simplify through evidence-backed deletion

按 code-simplification skill 先用 C34 inventory、git blame/callers 和 before/after replay 理解每个 validator 的原因，再小步删除 wrapper/alias/duplicate branch。若删除改变任何 fail-closed/error/status/privacy/receipt 行为，停止删除；不修改测试迎合“简化”。

### 5. Preserve portable, private-safe receipts

统一后的 control-plane output 只引用 portable identity、结论、totals 和 evidence refs；继续拒绝 credentials、absolute paths、raw payload、learner identifiers 和 provider internals。原有 immutable receipts 不覆盖，新的 normalization 产生新 identity。

## Risks / Trade-offs

- [Risk] 重复检查实际覆盖了不同 scope。→ 先比较输入字段、scope、caller 和 failure fixture；只有语义完全等价才合并，其他保持独立。
- [Risk] 观察性 qualified 被误认为安全许可。→ 明确唯一 release/rollback validator 和 consumer；静态测试拒绝其他 validator 写 selector。
- [Risk] 统一 helper 隐藏上游 receipt drift。→ helper 保留 source/tree/schema/receipt/denominator mismatch；缺失时 fail closed。
- [Risk] 删除 wrapper 影响 operator/CI。→ 先由 C34 inventory 确认 canonical caller；必要 compatibility alias 只转发且有 sunset 条件。

## Migration Plan

1. 冻结 C34 inventory 与 C0/业务 waves source identity，按 owner 列出每个 validator 的输入、输出、caller、authority 和删除候选。
2. 建立 before/after replay fixtures：clean、dirty/mixed、tree drift、stale/duplicate receipt、denominator/privacy conflict、qualified/blocked/unresolved 和 selector-no-change。
3. 在既有 owner 内复用 singular normalization/validation，迁移 canonical command caller，删除无独立语义 wrapper/alias。
4. 验证 release/rollback unique security validator 仍是唯一安全决策点，其他 validator 无 production write side effect。
5. 运行 architecture/fitness/quality/toolchain/release tests、typecheck/lint、`verify:commit`/`verify:push`、diff 和 OpenSpec strict validation。

回滚只恢复旧 wrapper/caller mapping，不恢复第二套 validator 或降低 fail-closed；历史 receipts、selectors、部署和数据库不被改写。

## Open Questions

无。若两个 validator 的 scope/authority 尚未证明等价，应暂时保留并标为独立 owner，而不是强行合并。
