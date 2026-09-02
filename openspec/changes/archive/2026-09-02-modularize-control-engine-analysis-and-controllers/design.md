## Context

`rust/control-engine/src/lib.rs` 约 7,000 行，顶部已声明 `analysis` 与 `controllers` 模块，但大量请求类型、分析结果结构、传递函数/频率域计算、PID/structure 应用仍在根文件中。`analysis.rs` 目前只暴露请求错误检查，`controllers.rs` 仍是保留说明；这是一条真实的职责边界尚未落地，而不是需要再建立新 crate 的架构问题。

C25 只处理 analysis/controller 责任。C26 负责 simulation/metrics，C27 在两项模块化稳定后做共享计算简化；三者共享现有 `control-engine-wasm-facade` 合同。

## Goals / Non-Goals

**Goals:**

- 让 analysis、controller 参数/结构应用各自拥有可读、可测试的 Rust 实现模块。
- 让 `lib.rs` 主要承担 facade-facing decode/dispatch/export，而非所有数值实现。
- 保持 public WASM exports、请求/结果 JSON、model id、单位、非有限值和 tolerance 语义。
- 记录每一类移动的 before/after 文件和符号归属，避免 wrapper 链。

**Non-Goals:**

- 不创建第二个 crate、WASM facade、Artifact/Run contract 或 TypeScript numerical path。
- 不改变算法、采样、固定步长、Arena evaluator、server authority、preview/official 或历史结果。
- 不为降低 `lib.rs` 行数删除唯一 guard、错误语义、约束检查或公开导出。

## Decisions

### 1. Move implementation by responsibility

先由符号和调用关系划分请求验证、线性/频域分析、PID/结构控制器应用、结果组装；将实现直接放入已有 `analysis.rs`/`controllers.rs`，必要时在其下建私有子模块。`lib.rs` 只保留 facade 需要的公开导出、解码和 dispatch；不以 re-export 套 re-export 伪装模块化。

### 2. Preserve the existing facade and ABI

Rust 内部函数可改变可见性和位置，但 `wasm_bindgen` 导出名、JSON 字段、模型 id、单位、错误文本类别以及 generated package identity 不变。任何必须改变的公开合同都应另立版本化变更，C25 不吸收。

### 3. Verify numerical behavior at the module boundary

迁移前先锁定 analysis/controller 的 Rust unit/integration cases；迁移后对同一输入比较结果、非有限值拒绝、参数边界、错误状态和绝对/相对 tolerance。客户端、worker 和 server facade tests 只验证调用合同，不在 TypeScript 复制计算。

### 4. Keep sibling work independent

C25 只修改 analysis/controller 相关符号和其测试；C26 独立处理 simulation/metrics。两者共享 facade 验证，但不互相搬动文件或修改同一职责，以便 C27 有可审计的 before/after 基线。

## Risks / Trade-offs

- [Risk] 私有类型移动导致 serde 或 WASM 导出细节变化。→ 以 JSON fixture、generated ABI/build identity 和 facade tests 逐项对照。
- [Risk] 分析与 controller 共享的约束被重复或遗漏。→ 保留唯一 boundary validator，列出调用顺序和 non-finite/constraint cases。
- [Risk] 为缩短 `lib.rs` 引入 wrapper 链。→ 要求直接调用新模块，静态检查 root exports 和调用路径。

## Migration Plan

1. 冻结当前 Rust analysis/controller 输出、错误和 tolerance fixtures。
2. 生成符号归属表，先迁移一类职责并运行 Rust tests，再迁移下一类。
3. 收缩 `lib.rs` 到 facade/decode/dispatch，删除原实现和无用 imports，更新模块测试。
4. 验证 generated WASM package、client/worker/server facade 和 Arena/Practice consumers 未见 ABI 或结果漂移。
5. 记录 C25 revision-bound receipt，供 C27 与 C26 汇合后使用。

Rollback 恢复本 change 的单一提交即可；不得恢复第二套 TypeScript 数值实现或另一套 facade。生产运行时不在本变更中发布/切换。

## Open Questions

无。若符号的 owner 同时属于 simulation/metrics，留在 C25/C26 边界审计中，不跨任务复制实现。
