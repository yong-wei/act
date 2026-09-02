## Why

六类学习问答已有 `requiredSections`，但系统提示只罗列中文标题，并与默认 150 字上限冲突。评测按固定标题字符串命中，模型常用语义等价章节却被判失败；概念辨析、开放讲解和事实解释的综合通过率为 0%。结构契约没有变成可执行、可容错验证的输出合同。

## What Changes

- 把六类意图的章节变成带别名的输出合同，并写入系统提示：必须分章作答，允许语义等价标题。
- 新增可复现的结构评分器：按章节标题/别名匹配，拒绝无结构长文本；简洁、表格、分步、提示偏好不得省略章节。
- 结构合同优先于一般字数上限。不更换模型，不靠放宽阈值掩盖未执行结构。

## Capabilities

### New Capabilities

- `konling-study-question-structure-contract`: 定义六类讲解结构输出合同、语义等价评分，以及偏好兼容规则。

### Modified Capabilities

None. `answerIntent` 与既有 `requiredSections` 字符串数组形状保持兼容。

## Impact

- `src/lib/konling-agent-runtime.ts`、`src/lib/ai-prompt-builder.ts`。
- 新增结构目录、评分器与回归测试。
- 不改模型供应商，不实现 #1818 规范 fail-closed 门禁。
