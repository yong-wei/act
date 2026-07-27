## Why

教师批阅应优先看到学生实际提交的正文和原件，而不是后台转换文本、错误码或处理状态。AI 建议依赖的证据不完整时，需要在建议旁给出可理解的核对提示，并保留教师最终确认权。

## What Changes

- 批阅区消费统一封存答案、附件身份和提交顺序，按学生提交时的正文与附件顺序原样展示渲染正文和原始附件。
- PNG、JPEG 直接显示图片，PDF 使用内嵌阅读器，DOC、DOCX、PPTX 以文件卡片打开或下载原件。
- 不向教师展示附件转换文本、转换状态、错误码或后台处理过程。
- AI 建议旁使用非技术提示说明部分附件未纳入建议，并列出对应附件名称。
- 为证据不完整建议提供确认控件、非技术提示和 revision-bound 请求参数；服务端审批门禁与审计仍由附件理解 change 唯一负责。
- 不定义附件转换管线或外部处理政策。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `document-rubric-grading-workbench`: 修改教师批阅中的原始证据呈现、格式预览、缺失提示和确认门槛。

## Impact

- 影响教师批阅工作台、受保护原件读取、格式预览组件、AI 建议状态和审批交互。
- 实现依赖 `unify-assignment-response-contract` 提供统一封存答案、附件身份与顺序，并依赖 `govern-assignment-attachment-understanding` 提供附件理解缺失、审批门禁与审计合同。
