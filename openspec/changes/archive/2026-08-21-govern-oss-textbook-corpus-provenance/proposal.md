## Why

教材与参考书已经通过不可变 OSS v2 Blob Release 保存，但“对象仍在 OSS”“某个 Release 声明该对象”“当前 active runtime 向消费者暴露该教材”是三种不同状态。现有教材 provenance 能证明输入 revision、digest 和文件数，却没有把 resourceSet 身份、精确书目集合及其 runtime/index 闭包作为可直接审计的语义合同绑定到外置 bundle 与 active/rollback Release，容易再次把历史七本库存、当前两本准入集合和应用 HEAD 混为一谈。

## What Changes

- 将教材输入 provenance 升级为显式的 OSS 教材语料准入证明，绑定 `resourceSetId`、规范化 book IDs、authoring source revision、输入摘要/文件数和生成器身份。
- 保持应用 Release revision 与教材 authoring source revision 相互独立，同时要求 runtime、hybrid index、resourceSet 和外置 bundle 对同一教材语料身份完全一致。
- 要求 v2 runtime Release 的外置来源声明、source-provenance proof 和不可变 manifest 间接绑定完整教材准入证明；仅有历史 Blob 或 rollback 可达性不得被解释为 active 教材准入。
- 增加凭据安全的 active/rollback/candidate 教材语料检查结果，明确报告 Release 身份、激活状态、resourceSet、书目集合与 provenance 一致性，不输出对象 key、路径、凭据或签名 URL。
- 将候选激活的教材消费端 smoke 从“至少一本可读”改为对声明 resourceSet 中每本教材逐项验证 reader/runtime，并验证 hybrid index 精确书目集合。
- 既有 `act.textbook-runtime-input-provenance.v1` Release 保持不可变且可作历史审计；教材输入完全不变的后继 runtime Release 可原样继承冻结 v1 bundle，任何教材语料变化均不得借兼容路径绕过升级后的准入证明。
- 不重新上传、复制或改写既有 OSS Blob/Release，不自动激活历史七本集合，也不要求教材 source revision 等于应用或 PR HEAD。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `structured-textbook-runtime`: 定义 resourceSet 感知的教材输入 provenance、历史 v1 兼容边界和新发布的失败关闭要求。
- `textbook-hybrid-retrieval`: 将 hybrid index 的精确书目集合、source revision 和 manifest identity 纳入同一教材语料准入证明。
- `content-addressed-runtime-release-storage`: 区分 OSS 库存、Release 可达性和 active 准入，并要求外置 bundle、source proof、检查结果及逐本候选 smoke 绑定同一教材语料身份。

## Impact

- 教材导出与验证：`scripts/release/export-textbook-runtime-v2.mjs`、`validate-textbook-runtime-v2.mjs`、`textbook-runtime-v2-provenance.mjs`。
- 外置 bundle 与 v2 Release：`src/lib/runtime-external-input-bundle.ts`、`runtime-release-git-snapshot.ts`、source-provenance proof、发布/检查 CLI。
- 候选物化与激活：`scripts/runtime-release/activate-runtime-blob-release.sh` 及相关回归测试。
- 现有 OSS active/rollback Release、Blob 和本机 ignored/generated runtime 不发生原地变更；新的证明只随后续不可变 Release 发布。
