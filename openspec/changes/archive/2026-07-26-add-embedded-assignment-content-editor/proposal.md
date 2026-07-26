## Why

作业题目、参考答案和学生正文目前缺少统一的嵌入式内容编辑契约，容易退化为普通文本框、弹窗编辑器或各自维护的 Markdown 实现。平台需要把既有共享文档编辑能力收敛为适合作业字段的轻量模式，并明确保存后的阅读呈现。

## What Changes

- 为共享内容编辑器增加作业嵌入模式，仅承载题目、参考答案和学生正文。
- 编辑状态支持 Markdown、公式和图片，并支持选择文件、拖入或粘贴图片。
- 保存成功后退出编辑状态，以渲染结果展示内容；保存失败或冲突时保留编辑内容和恢复入口。
- 该模式不承接整页工作台、结构导航、AI 建议栏或作业业务校验。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `preparation-document-editor`: 在项目共享编辑器能力中增加有边界的作业嵌入模式。

## Impact

- 影响共享编辑器适配层、Markdown/公式/图片渲染与图片上传接口。
- 为 `redesign-assignment-authoring-workspace` 和 `redesign-student-assignment-response-editor` 提供统一编辑器依赖；不改变作业发布、评分或作答持久化契约。

