# OSS 教材语料准入与生命周期状态

状态: active
最后更新: 2026-08-21
摘要: 区分 OSS 库存、Release 声明、resourceSet 准入和 active/rollback 选择。教材 authoring revision 与应用/Release HEAD 分域比较。

## 四层状态

1. **stored**：内容寻址 Blob 存在于私有 OSS。对象仍在不等于可教、可回滚或已激活。
2. **release-declared**：某个不可变 runtime Release manifest 声明了对应逻辑路径。
3. **admitted**：`act.textbook-runtime-input-provenance.v2` 证明 resourceSet、精确书目、`authoringSourceRevision`、输入摘要和生成器身份。
4. **lifecycle-selected**：host lifecycle 把该 Release 标为 active、rollback 或 candidate。

历史七本仍可由 rollback Release 恢复，不代表它们已被当前两本 resourceSet 准入。

## Revision 分域

- `authoringSourceRevision` 只标识冻结教材 authoring 输入。
- bundle/declaration `sourceRevision`、`baseSourceRevision` 与 runtime Release `sourceRevision` 标识捕获或应用发布。
- 两类 revision 不得要求相等，也不得用 PR HEAD 覆盖教材 revision。

## v1 兼容

既有 `act.textbook-runtime-input-provenance.v1` Release 保持不可变。教材前缀、declaration Git object 和 bundle digest 完全不变时，后继 runtime 可原样继承。任何书目、字节或声明变化必须升级到 v2。检查结果把 v1 标为 `legacy`，不补造 resourceSet。

## 检查

只读入口：`scripts/runtime-release/inspect-textbook-corpus.py`。

输出 Release 身份、lifecycle 状态、provenance generation、已证明的 resourceSet/书目、authoring revision 和 runtime/index 一致性。不输出 object key、主机路径、mount、凭据或签名 URL。检查不是 selector，也不发布 runtime。
