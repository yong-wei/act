## Context

生产 runtime 已采用私有 OSS v2 Blob Release、宿主机只读物化 view 和本地 lifecycle selector。当前 active Release `runtime-89fef308...` 的教材前缀只包含 `control-encyclopedia` 与 `hu-shousong-exercise-analysis-3rd`；受保护的 rollback Release `runtime-83449946...` 仍包含历史七本集合。两者均由不可变 manifest 和内容寻址 Blob 支撑，因此历史资源仍在 OSS 并不等于它们属于当前 active 教材语料。

当前外置教材 bundle 已绑定 bundle semantic/wire digest、声明 Git object、输入 digest/count 和每个文件的内容身份。`input-provenance.json` v1 只显式记录 authoring source revision、input digest 和 input file count；resourceSet 身份与书目集合只能从其他文件和配置间接重建。候选激活 smoke 只抽取 catalog 中一本教材验证 reader，无法直接形成“该 Release 对声明的每本教材均可消费”的验收证据。

本设计在现有不可变 Release 与 external bundle 之上补充语义治理，不创建第二套存储或可变生产指针。

## Goals / Non-Goals

**Goals:**

- 明确定义 stored、release-declared、admitted、active/rollback 四类状态，禁止从 Blob 存在性推断 active 准入。
- 让发生教材语料变化的新 external bundle 自包含 resourceSet、书目集合、authoring revision、输入摘要和生成器身份。
- 让 tracked declaration、bundle semantic/wire digest、runtime Release manifest 与 source-provenance proof 保持同一证明链。
- 提供不泄漏 OSS key、路径或凭据的 active/rollback/candidate 教材语料检查结果。
- 对新候选的声明书目逐本执行 runtime/reader smoke，并校验 hybrid index 精确集合。

**Non-Goals:**

- 不把历史七本自动加入当前 resourceSet，不修复或重新审核其中不完整教材。
- 不原地修改 active、rollback、历史 Release 或内容寻址 Blob。
- 不要求教材 authoring source revision 等于 runtime Release source revision、应用 revision 或 PR HEAD。
- 不改变 OSS IAM、开发者 RAM 凭据分发、媒体签名或生命周期 GC 算法。
- 不在提案阶段执行 production selection、runtime publish 或应用部署。

## Decisions

### 1. 存储、准入与激活使用不同身份

OSS Blob 只证明内容对象存在；不可变 Release manifest 证明一组逻辑路径可由这些 Blob 重建；教材准入证明再声明这组路径对应哪个 resourceSet、哪些书以及哪个 authoring 输入；active lifecycle 最后证明当前消费者实际绑定哪个 Release。检查工具必须分别报告这些状态，rollback 只能报告为 rollback，不得显示为 active。

替代方案是把 OSS Bucket 前缀或目录枚举当教材库存。该方案不能证明对象属于哪个完整 Release，也无法区分未完成上传、历史保留和当前激活，因此不采用。

### 2. 教材语料变化采用 provenance v2，冻结 v1 可继承

新增 `act.textbook-runtime-input-provenance.v2`，至少包含：

- `authoringSourceRevision`
- `resourceSetId`
- 规范化且唯一的 `bookIds`
- resourceSet canonical digest
- `inputDigest` 与 `inputFileCount`
- generator id/version

`authoringSourceRevision` 只标识冻结教材 authoring 输入；现有 external bundle 的 `sourceRevision` / `baseSourceRevision`、Git declaration object 与 runtime Release manifest `sourceRevision` 标识应用发布或捕获 revision。两类 revision 必须分别比较，不得要求相等，也不得用应用/Release/PR HEAD 覆盖教材 revision。

对应 external bundle declaration 升级后携带同一语义摘要，并继续绑定 bundle semantic/wire digest。发生 resourceSet、书目、runtime/index、输入 revision 或 bundle 字节变化时必须生成 v2；v1 不得作为新教材语料变化的证明。

已有 v1 external bundle 可以在教材前缀和 bundle/declaration 身份完全不变时被后继 runtime Release 继承，以免一次无关课程媒体更新强制重生成教材。既有 active/rollback Release 保持可验证、可回滚和不可变；检查结果明确标为 legacy provenance，不补造 resourceSet 字段。

### 3. Release 证明链复用现有 external source identity

不把完整教材 provenance 重复写入顶层 runtime manifest。新 declaration 的 Git object、bundle semantic/wire digest 和外置文件 source identity继续进入 manifest/source-provenance proof；由于 bundle semantic digest覆盖 provenance、generator、overlay 和完整文件列表，Release 可间接且不可变地绑定教材准入证明。

发布 preflight 必须同时打开 declaration、bundle、`input-provenance.json`、各书 manifest 和 hybrid index manifest。各书 manifest、hybrid index 与 v2 provenance 之间比较 `authoringSourceRevision`、resourceSet、书目、digest 和 index identity；bundle capture、Git declaration、source-proof 与 runtime Release manifest 之间比较各自的 release/capture revision 和内容身份。跨这两组不得建立 revision 相等条件。仅比较 file count 或仅看到相同 Blob 不足以通过。

### 4. 检查结果是派生报告，不是新选择器

新增只读检查入口，输入一个已验证的 active、rollback 或显式 candidate identity及其物化 view/manifest。输出包括 Release ID、manifest/tree digest、状态、external input ID、provenance schema、resourceSet、book IDs、authoring revision、输入摘要/数量、runtime/index 一致性与最终状态。

输出不得包含 OSS object key、逻辑/主机绝对路径、Blob mount、AccessKey、签名 URL 或未激活 candidate 细节。报告不写 OSS，不改变 lifecycle，也不能作为 production selector。

### 5. 候选 smoke 覆盖候选 Release 自身的每本教材

v2 候选激活从准入证明取得精确 book IDs。v1 候选或 rollback 重新选择时，只能从该候选不可变 Release 自身已经过 manifest/source-proof 验证的教材 catalog 与 runtime manifest 路径集合枚举 book IDs；该集合只用于消费兼容 smoke，不得补造 resourceSet admission，也不得从当前 active resourceSet 或其他 Release 推断。对每本教材至少验证 catalog 唯一条目、结构化 runtime 可加载、一个稳定代表性 unit 可读、reader projection 有正文和层级；随后验证该候选 Release 内 hybrid index 的 books 集合与候选 book IDs 精确一致，v2 还必须验证 resourceSetId 与 `authoringSourceRevision`。任一教材失败时保留原 active/rollback。

不要求逐页渲染或对全部检索窗口做在线查询；schema、闭包和全量 index 校验仍由发布 preflight 负责，激活 smoke 关注物化 view 与真实消费者兼容性。

## Risks / Trade-offs

- [provenance schema 升级使历史 Release 无法原地满足新字段] → 保持 v1 历史兼容，只对教材语料发生变化的新 bundle 强制 v2，绝不改写旧 Release。
- [检查报告与真实 lifecycle 漂移] → 在同一次只读检查中读取受锁/已验证的 lifecycle identity、manifest 与 view receipt；发生 generation 或 identity 漂移即不输出成功状态。
- [逐本 smoke 增加激活耗时] → 每本只读取一个确定性代表 unit，完整内容验证留在发布 preflight。
- [resourceSet digest 计算实现分叉] → Node/Python 共享 canonical JSON 规则和跨语言 fixture，digest 不匹配时失败关闭。
- [误把 rollback 七本解释为可重新准入] → 报告同时显示 lifecycle state 与 provenance generation；legacy rollback 只证明可回滚，不授予新 resourceSet 准入。

## Migration Plan

1. 增加 v2 provenance schema、canonical resourceSet digest 和跨语言测试，保留 v1 parser。
2. 升级 external bundle/declaration 与 release preflight；证明 authoring revision 与应用/Release revision 不同时仍可发布，并证明未改变教材前缀的 v1 继承仍可通过。
3. 增加 active/rollback/candidate 教材语料只读检查命令及身份漂移回归。
4. 将候选激活 smoke 改为逐本验证；v2 从 provenance、v1 从候选 Release 自身已验证 catalog/manifest 枚举，并补 v1 两本继承、七本 rollback 重选、非首本损坏以及 active/rollback 不混淆测试。
5. 下一次教材语料实际变化时生成 v2 bundle并随新的不可变 runtime Release 发布；既有 active/rollback 不原地迁移。
6. 若新候选验证失败，保持现有 active/rollback 和所有 OSS 对象不变。

## Open Questions

无。当前 active 两本、rollback 七本及二者的 Release 身份已经通过生产只读证据确认；是否将历史教材重新纳入新的 resourceSet 属于独立内容审核与发布决策。
