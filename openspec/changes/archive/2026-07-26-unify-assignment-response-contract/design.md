## Context

Canonical assignments currently persist a response type and permit document upload only when a question declares a supported document response. The agreed contract removes the text/file split from active behavior: one question answer may contain Markdown text, embedded image assets, and ordered independent attachments. Historical publication snapshots and hashes must remain unchanged for audit.

## Goals / Non-Goals

**Goals:**

- Define one question-level answer aggregate for text and zero or more ordered attachments.
- Enforce at least one evidence component at submission and at most ten attachments per question.
- Count embedded editor images and independent uploads against the same limit.
- Preserve allowed formats, order, immutable attempts, asset integrity, authorization, and idempotency.
- Make legacy `TEXT`/`FILE` rules non-restrictive without rewriting frozen history.

**Non-Goals:**

- 不设计学生端编辑、拖放或状态界面。
- 不转换或理解附件内容。
- 不改变单文件大小限制、对象存储安全合同或问题级独立提交。

## Decisions

### 1. 一个答案聚合同时保存正文和附件引用

可变草稿包含 Markdown 正文、附件记录和显式顺序。内嵌图片也是受保护的 submission asset，并带正文位置引用；独立附件使用连续排序键。提交尝试冻结正文快照、附件身份集合和顺序。

### 2. 附件额度由服务端权威计算

服务端按当前问题草稿中所有有效内嵌图片和独立附件去重计数，最大十个。签名、完成、重排和提交均重验上限；客户端预检只改善反馈，不是权威门禁。

### 3. 允许格式使用规范化 MIME 与扩展名双重校验

允许 PDF、DOC、DOCX、PPTX、PNG、JPEG、Markdown 和纯文本。服务端在签名和完成阶段校验声明、对象元数据与检测结果；ODT、XLS、XLSX 明确拒绝。

### 4. 顺序是答案合同的一部分

附件重排以问题草稿修订为并发基线，并提交完整有序资产 id 列表。服务端验证集合完全相同后原子更新排序，避免遗漏、重复或越权资产。新答案的明确学生排序记录 provenance=`student-arranged`。

历史附件只有在现有持久化证据能证明学生顺序时才使用该 provenance。无法证明时按稳定键生成 `legacy-fallback` 顺序并持久化 provenance；相同历史输入重复迁移必须产生同一顺序，且不改写旧发布快照或声称该顺序由学生选择。

### 5. 旧响应规则只作为历史快照

新教师与学生读写投影、上传签名、完成和提交均忽略 `TEXT`、`FILE` 等旧规则对可用输入的限制，只消费统一 response contract。迁移不改原发布 revision 字段、内容哈希或历史 attempt 关联；旧字段仅供审计，兼容层统一映射到新聚合。

## Risks / Trade-offs

- [同一图片被重复引用导致计数歧义] → 按稳定资产身份去重，正文中的无效或跨答案引用拒绝保存/提交。
- [上传与重排并发] → 使用答案草稿修订做 CAS，冲突返回结构化恢复结果。
- [MIME 伪装] → 完成阶段复核对象元数据和内容检测，失败资产不得进入答案。
- [旧客户端依赖响应类型] → API 接受旧字段但不据此拒绝文本或附件，并记录兼容路径使用情况。

## Migration Plan

1. 增加统一答案字段、附件排序和内嵌位置引用，保持旧字段只读。
2. 更新签名、完成、重排、草稿保存和提交 API。
3. 部署教师、学生、签名、完成和提交兼容投影，使旧发布 revision 在不改哈希的情况下使用统一作答。
4. dry-run 核对历史答案、资产关联和可证明顺序；apply 持久化 `student-arranged` 或稳定 `legacy-fallback` provenance，不重写冻结快照。
5. 回滚客户端时保持 API 双读；已创建的统一答案不得拆分或丢弃附件。

## Open Questions

- 无；附件内容如何进入评分由 `govern-assignment-attachment-understanding` 定义。
