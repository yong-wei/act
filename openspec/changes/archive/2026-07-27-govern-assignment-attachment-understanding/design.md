## Context

The canonical grading pipeline permits approved local conversion and eligible fallback for documents. The agreed assignment policy is stricter: binary submission attachments use Mathpix only for semantic understanding, while Markdown and plain text are read directly. Binary local extraction may support transport or rendering elsewhere, but it cannot become grading evidence. External-processing policy can disallow Mathpix without disallowing student submission or teacher access to the original.

## Goals / Non-Goals

**Goals:**

- Route binary assignment attachments through Mathpix only for grading understanding.
- Read Markdown and plain-text attachments directly with bounded decoding.
- Assemble evidence in the exact response order, preserving embedded image positions.
- Represent policy denial and terminal conversion failure as explicit missing understanding.
- Allow a draft suggestion from remaining evidence but require teacher confirmation before it becomes a grade.

**Non-Goals:**

- 不设计教师原件预览界面。
- 不使用 MarkItDown、OOXML、图片 OCR 或其他本地语义提取作为二进制附件兜底。
- 不改变上传格式、数量、顺序或对象存储合同。

## Decisions

### 1. 按格式族选择唯一语义路径

PDF、DOC、DOCX、PPTX、PNG、JPEG 标记为 binary-mathpix；Markdown 和纯文本标记为 direct-text。路由写入冻结的 evidence input manifest。二进制附件的任何本地派生文本都不得进入 rubric evaluator payload。

### 2. Mathpix 前执行既有外部处理政策

政策必须明确允许班级范围、数据类别、`answer-conversion` 目的、区域/协议、禁训练、保留与删除能力。拒绝时不发送内容，附件进入 `UNDERSTANDING_UNAVAILABLE_POLICY`，但原资产保持可授权人工批阅。

### 3. 直接文本读取仍受完整性与边界保护

读取前验证资产 checksum/size，按声明格式使用 UTF-8 或受控检测，限制最大字符数并记录截断/解码限制。它不经过 Mathpix，也不绕过答案与班级授权。

### 4. 证据 manifest 固定拼装顺序

先加入学生正文；正文中的内嵌图片转换结果插回对应 Markdown 位置；之后按学生持久化顺序追加独立附件结果。每段保存来源 asset id、顺序、内容 hash、理解状态与限制，不把失败内容伪装为空文本。

### 5. 不完整证据产生受限建议

至少存在学生正文或一个成功附件结果时，evaluator 可生成 `EVIDENCE_INCOMPLETE` 建议，并列出未纳入附件的安全名称。该建议不能自动批准或形成成绩，必须经过教师显式确认。没有可评分证据时保持阻断。

### 6. Mathpix-only 是作业响应二进制附件的窄例外

非作业文档批改继续使用 canonical converter routing，包括已治理的本地适配器。只有绑定统一作答 attempt 的 PDF、DOC、DOCX、PPTX、PNG、JPEG 禁止 MarkItDown、OOXML 或其他本地语义结果进入新 evaluator、batch 和写回链路。Batch 根据冻结来源类型选择路径，不能因缺少 Mathpix policy 回退本地二进制语义。

### 7. 历史本地二进制结果按批准状态迁移

dry-run 枚举本地二进制 conversion、AnswerEvidence、grading run、batch item 与 queue job 的完整关联及批准状态。Apply 保留所有已批准历史和审计；未批准链路标记 `legacy-ineligible` 或 `BLOCKED`，清除新 evaluator/writeback readiness，并停止活跃 queue 消费。迁移幂等，不删除原件或伪造 Mathpix lineage。

## Risks / Trade-offs

- [Mathpix 故障降低自动批改覆盖] → 保留重试、原件人工批阅和清晰的缺失状态，不使用不受治理的兜底。
- [直接文本包含恶意指令] → 仍作为不可信答案数据进入无工具 evaluator，并保留既有 prompt-injection 边界。
- [内嵌位置与附件结果错配] → 使用冻结资产 id 和 Markdown anchor，而不是文件名匹配。
- [部分证据建议被误当最终成绩] → 数据状态和批准事务双重要求教师确认。
- [Mathpix-only 例外误伤非作业文档] → 路由以统一作答 attempt 绑定为判据，非作业文档保持 canonical converter contract。
- [旧本地转换继续进入新批改] → apply 同时冻结 conversion/evidence/run/queue readiness，并以消费链 invariant 验证阻断。

## Migration Plan

1. 增加格式族路由、理解状态和 evidence input manifest 版本。
2. 让 Markdown/txt 直接读取与 binary Mathpix 路由并行上线。
3. 运行 dry-run，核对已批准历史、未批准本地二进制链路及其 queue/writeback readiness。
4. Apply 保留已批准历史，将未批准链路标记 legacy-ineligible/blocked 并清除新消费 readiness。
5. 禁止新的 assignment response binary 本地语义结果进入 evaluator，同时保持非作业文档原 converter 路径。
6. 接入不完整证据状态和教师确认门禁后启用混合答案。
7. 回滚时停止新自动理解，但不得恢复 assignment response binary 本地 fallback 或重新启用已阻断链路。

## Open Questions

- 无；原件如何向教师展示由 `refine-assignment-review-evidence-presentation` 定义。
