## Context

`unify-assignment-response-contract` establishes one answer containing Markdown text and ordered attachments, while `add-embedded-assignment-content-editor` provides the shared response-body editor. This change composes those contracts into the student experience. It does not infer conversion state or block submission while back-end understanding is pending.

## Goals / Non-Goals

**Goals:**

- Let students write text and add embedded images through the shared editor.
- Let students select or drag independent attachments, see their sequence, and reorder them.
- Explain that grading consumes attachments in the displayed order and recommend importance order.
- Provide localized preflight errors and clear per-file and per-question states.
- Preserve question-level validation, focus recovery, mobile operation, and independent submission.

**Non-Goals:**

- 不实现 Mathpix、直接文本读取或证据拼装。
- 不展示附件转换状态。
- 不改变十附件、格式、对象存储或提交 API 合同。

## Decisions

### 1. 正文编辑器与附件列表属于同一题目表单

正文使用共享嵌入编辑器；独立附件位于正文之后。内嵌图片在编辑器中保持对应位置，但也进入统一附件计数。问题级状态摘要同时反映正文保存、附件上传和提交状态。

### 2. 独立附件顺序显式可见且可调整

列表显示从 1 开始的序号并支持指针拖动与键盘上移/下移。排序提交完整资产 id 序列和答案修订；成功后才更新权威顺序，冲突时恢复服务端顺序并保留提示。

### 3. 客户端预检与服务端结构化错误使用同一映射

选择文件时预检允许格式、现有单文件大小限制和剩余额度。服务端仍是权威，返回字段化 code/path/limit；界面将其映射为中文，不显示 `invalid-payload` 等内部标识。

### 4. 状态分为资产与题目两层

每个附件显示等待上传、上传中、已完成、失败和移除中。题目显示草稿保存、可提交、提交中、已提交和失败。上传未完成或失败会进入问题清单并定位文件项。

## Risks / Trade-offs

- [拖动与上传完成同时发生] → 未完成资产保持临时位置，服务端只接收已完成集合的 revision-guarded 顺序。
- [内嵌图片额度对学生不直观] → 剩余额度同时显示内嵌图片和独立附件计数。
- [移动端拖动困难] → 始终提供键盘和按钮式上移/下移替代。
- [服务端返回未知错误码] → 显示安全通用中文错误并保留重试，不暴露原始 code。

## Migration Plan

1. 等待两个显式依赖的 API 和共享编辑器合同可用。
2. 接入统一表单与只读状态，不改变现有提交入口。
3. 接入多附件上传、排序和结构化错误映射。
4. 完成移动端、键盘和问题级提交验收后移除旧响应类型分支 UI。
5. 回滚 UI 时保留统一 API 数据，旧界面只读展示不能丢弃多附件。

## Open Questions

- 无；附件理解失败不改变学生提交界面，由后续批阅 change 呈现。

