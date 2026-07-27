## Why

教师作业编辑需要围绕题目组织、评分项和发布条件形成清晰的单页工作区，而不是把作业信息、题目内容和发布设置分散在重复或工程化控件中。新的布局应让保存状态、字段问题和总分始终可理解、可定位。

## What Changes

- 左侧题目大纲依次提供“从题库选择”“新建题目”和当前题目列表。
- 主栏先显示一次作业标题与说明，再显示题目内容、评分项手风琴和默认折叠的发布设置。
- 评分项折叠摘要显示名称、分值、排序与删除操作；展开后承载评分标准和可选评分细则入口。
- 题库来源、题型、审核状态、版本和评分准备状态统一显示中文标签。
- 持续显示“正在保存、已保存、保存失败、存在冲突”状态；发布校验提供可定位的问题清单，字段问题保留在原位置。
- 作业总分由题目分值自动汇总；占位示例不进入正文。
- 教师侧移除 active `TEXT`/`FILE` 响应类型分支，题目编辑与预览统一消费统一作答 projection；旧字段只用于历史审计。
- 不定义评分细则算法、发布幂等或学生响应模型。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `assignment-authoring-and-publication`: 重构教师编辑工作区的信息架构、保存状态、发布校验定位和总分呈现。

## Impact

- 影响教师作业编辑路由、题目大纲、评分项组件、发布设置、中文标签映射和表单可访问性。
- 实现依赖 `add-embedded-assignment-content-editor`、`revise-assignment-rubric-contract`、`harden-assignment-publication-identity` 与 `unify-assignment-response-contract` 提供的字段编辑、评分、发布状态和统一作答合同。
