## Context

The grading workbench currently emphasizes converted precision, limitations, and evidence anchors. This change explicitly depends on `unify-assignment-response-contract` for the unified sealed answer, exact attachment identities, and frozen submission order, and on `govern-assignment-attachment-understanding` for incomplete-evidence state, approval enforcement, and audit. Understanding status belongs beside the AI suggestion only when it affects the suggestion, and must use non-technical language.

## Goals / Non-Goals

**Goals:**

- Present the original answer faithfully and in submission order.
- Preview PNG/JPEG and PDF in place, and provide protected open/download actions for office files.
- Keep conversion text, processing status, provider details, and error codes out of the original-answer region.
- Show a concise missing-attachment notice next to the AI suggestion.
- Collect explicit confirmation and send the governed revision-bound approval parameters for an incomplete-evidence suggestion.

**Non-Goals:**

- 不定义 Mathpix、直接读取、重试或 evidence manifest 的生成。
- 不改变学生提交内容或顺序。
- 不向教师提供转换文本调试界面。
- 不实现不完整证据的服务端审批门禁、确认审计或写回阻断；这些由 `govern-assignment-attachment-understanding` 唯一拥有。

## Decisions

### 1. 原始作答与 AI 建议是两个独立区域

原始作答区域只消费统一封存答案的正文、精确附件身份、顺序 provenance 和 authorized original asset projection。AI 建议区域消费评分草稿及其安全 limitations。转换产物不进入原始作答 projection，避免后台表示替代学生原件。

### 2. 预览按格式使用最小可信能力

PNG/JPEG 以受保护图片响应直接显示；PDF 使用隔离的内嵌阅读器；DOC/DOCX/PPTX 显示文件卡片，通过短时、用途绑定访问打开或下载。所有读取复用完整性校验、授权、`nosniff` 和 private no-store。

### 3. 缺失提示使用安全展示名

建议旁显示“部分附件未纳入本次建议，请结合原件核对”，并列出失败附件的安全文件名。不得显示 provider、错误码、转换状态或转换文本。

### 4. 确认控件只提交治理合同所需输入

当 draft 标记 `EVIDENCE_INCOMPLETE` 时，界面收集 teacher confirmation、当前 draft revision 和治理合同要求的遗漏附件身份，并提交给 govern change 拥有的审批端点。界面消费审批成功、缺少确认和 stale revision 结果，但不另建服务端门禁或审计路径。

## Risks / Trade-offs

- [浏览器无法内嵌某些 PDF] → 提供同一受保护资源的打开/下载回退。
- [文件名包含敏感路径或控制字符] → 只显示持久化安全 basename，并做长度与字符规范化。
- [原件访问 URL 泄露] → 按次授权、短时用途绑定，不记录完整 URL。
- [教师忽略缺失提示] → 未确认时服务端拒绝批准，不依赖视觉提示本身。

## Migration Plan

1. 增加原始作答 review projection 和安全附件展示字段。
2. 接入格式预览与访问授权。
3. 接入不完整证据提示、确认控件和 govern-owned 审批请求参数。
4. 移除教师页面上的转换文本与技术状态展示，但保留受限运维诊断。
5. 回滚 UI 时服务端确认门禁保持启用，避免不完整建议被旧界面直接批准。

## Open Questions

- 无；附件理解状态由依赖 change 提供。
