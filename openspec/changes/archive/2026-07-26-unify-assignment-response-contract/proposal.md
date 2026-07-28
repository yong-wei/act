## Why

现有 `TEXT`、`FILE` 等互斥作答规则无法表达学生正文与多个附件共同构成答案的实际需求，也会让上传、提交和批改消费不同的数据口径。需要先建立统一的数据与 API 合同，再由学生界面和附件理解流程分别消费。

## What Changes

- 每道题至少提交文本或一个附件，允许文本与多个附件同时存在并共同构成完整答案。
- 每道题最多十个附件；内嵌图片与独立附件共同计数，继续遵循现有单文件大小限制。
- 允许 PDF、DOC、DOCX、PPTX、PNG、JPEG、Markdown 和纯文本；拒绝 ODT、XLS、XLSX。
- 持久化学生可调整的附件顺序，并让 API、提交快照和后续评分证据保留顺序来源；没有明确学生顺序的历史附件使用稳定 fallback order，不能冒充学生排列。
- 定义旧 `TEXT`、`FILE` 发布规则的兼容迁移：不再限制新读写行为，但保留原发布快照、内容哈希和历史提交关联。
- 定义结构化上传错误和服务端授权、计数、格式、顺序校验。
- 不包含学生界面设计，也不定义附件转换实现。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `assignment-authoring-and-publication`: 使发布的题目响应政策兼容统一文本与附件作答。
- `student-assignment-mission-center`: 统一每题答案、附件、顺序、数量、格式和兼容迁移的持久化与 API 合同。

## Impact

- 影响作业修订快照、题目答案与附件模型、上传签名/完成/提交 API、运行时 schema 和兼容迁移。
- `redesign-assignment-authoring-workspace`、`redesign-student-assignment-response-editor`、`govern-assignment-attachment-understanding` 与 `refine-assignment-review-evidence-presentation` 依赖本 change。
