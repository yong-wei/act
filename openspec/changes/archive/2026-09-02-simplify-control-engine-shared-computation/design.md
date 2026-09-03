## Context

C25/C26 预期使 `rust/control-engine/src/lib.rs` 退化为清晰 facade，并把 analysis/controllers、simulation/metrics 实现放入已有模块。模块化后才能判断哪些重复是职责边界、哪些只是相同的计算表达。C27 的目标不是继续拆目录，而是删除 canonical implementation 中可证明等价的共享计算。

本变更必须使用已读取的 `code-simplification` skill：先理解责任、caller、边界、测试和历史原因，再逐分块修改；每次简化后定向验证，无法证明行为保持就回退。C25/C26 的 facade、contract 和 receipts 是硬前置。

## Goals / Non-Goals

**Goals:**

- 识别并消除重复 simulation loop、metric aggregation、参数转换、重复内部 guard 和无价值 wrapper。
- 用 before/after 证据证明输出、错误、side effects、顺序、tolerance、ABI/export、preview/official 和 persistence 语义保持。
- 让新成员更快理解 canonical Rust 数值路径，并使 `lib.rs`/crate production bytes 不因简化增加。

**Non-Goals:**

- 不做纯文件搬迁、重命名、格式化、目录重排或新增抽象来制造“简化”指标。
- 不改 Artifact/Run contract、WASM facade、generated ABI、model ids、fixed-step protocol、Arena evaluator、server authority、UI 或 production selector。
- 不删除唯一数值安全边界、错误处理、hard constraints、非有限检查、replay identity 或历史兼容所需代码。

## Decisions

### 1. Invoke `code-simplification` only after both modularization changes

C27 开始时必须确认 C25/C26 的 revision-bound receipts 和 tests 通过。向 skill 输入目标文件、调用者、行为不变量、不可删除的 trust boundaries、characterization tests 和允许删除的 compatibility；它只处理 canonical implementation，不处理准备退役的旧入口。

### 2. Require a before/after record for every block

每个分块记录 source revision、symbol/file set、production bytes/lines、public exports/ABI、输入输出 fixtures、error/failure cases、tolerance、test commands、review decision 和 rollback commit。若只是移动文件、换名或包一层函数而 computation/理解没有改善，标记 `rejected-no-simplification`，不得计入完成。

### 3. Simplify shared pure computation, not authorities

可以合并分析与预览共用的纯计算、统一已验证的 metric fold 或减少重复数据转换；不得合并 Arena task scoring、hidden scenario resolution、server persistence、Practice/preview visibility 或 client/server authority。一个受保护事实仍只有一个 validator。

### 4. Verify exact behavior and stop after the accepted scope

每次简化后运行 Rust focused tests，再运行 facade/domain tests；比较 JSON、error category、side-effect/order、finite/constraint、checksum/replay 和 tolerance。发现新 P0/P1 或理解成本上升立即回退该块；完成 accepted blocks 后停止，不顺便清理其他 crate。

## Risks / Trade-offs

- [Risk] 把看似重复的 guard 合并后削弱数值安全。→ 以 trust-boundary ledger 标出唯一必要 validator，保留外部输入/非有限/hard-constraint guard。
- [Risk] 共享计算变化造成浮点或 trace 漂移。→ 使用固定 fixtures、绝对/相对 tolerance、checksum/replay 和 preview/official regression。
- [Risk] 为追求 LOC 产生晦涩抽象。→ 以可理解性为门槛；skill 报告若 after 更难读则回退，纯搬文件明确拒绝。
- [Risk] 简化触及 evaluator authority。→ 将 task scoring、hidden inputs、server persistence 和 leaderboard 纳入禁止区域并做 import/ownership 检查。

## Migration Plan

1. 验证 C25/C26 完成和 clean baseline，读取其 symbol/bytes/tolerance receipts。
2. 建立共享 computation 候选表，先运行现有 tests 和 before metrics。
3. 对一个分块主动调用 `code-simplification`，检查 diff 与 after metrics，运行 focused tests；逐块重复但不并行修改同一模块。
4. 通过 Rust/facade/Practice/Arena/replay/fixed-step tests、Ponytail review 和 scope guard；记录 accepted/rejected/deferred blocks。
5. 形成 C27 final before/after receipt；只有全部 accepted blocks 通过才可交付。

Rollback 恢复该分块的简化提交，不恢复第二套实现或 fallback。任何 authority/ABI/contract 变化都应拆为独立变更并使 C27 保持 blocked。

## Open Questions

无。若 C25/C26 未完成、没有可证明的重复计算或 skill 判断 after 更复杂，C27 应保持 blocked/无需修改。
