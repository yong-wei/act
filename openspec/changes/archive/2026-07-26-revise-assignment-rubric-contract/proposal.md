## Why

现有作业 rubric 契约把自然语言评分依据与复杂分档结构绑定为发布必填，并采用与产品共识不一致的精度和区间规则。教师需要默认简单、按需展开的评分模型，同时平台必须用确定算法保证级别边界和最终分数一致。

## What Changes

- 将“评分标准”定义为评分项的自然语言判分依据；未开启评分细则时直接据此在零分至满分之间评分。
- 将“评分细则”设为默认关闭的可选分档约束，并定义评价级别的名称、最高分值、评分准则与后台推断区间。
- 定义逐条新增、五级制、两级制、比例扩展、内容保留、删除确认、自动排序和最高级别同步算法。
- 统一评分项、级别、AI 建议、教师修订和最终成绩为一位小数；评分项满分不得低于 1.0 分。
- 定义相邻级别边界归属、级别内分数校正以及无法形成 0.1 分有效区间时的拒绝规则。
- 定义发布条件：关闭评分细则时评分标准必填；开启后每个级别评分准则必填，通用评分标准可为空。
- 批改侧按评分细则开关选择两类 evaluator schema：关闭时不要求评价级别，开启时才要求级别身份并校正 AI 建议分数。
- 教师人工修订不受 AI 级别区间夹取，只需满足一位小数和评分项零分至满分边界。
- 不包含 AI 生成交互或作业页面整体布局。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `assignment-authoring-and-publication`: 改写主观题评分标准、可选评分细则、分数精度、区间算法和发布门槛。
- `document-rubric-grading-workbench`: 使批改 schema、AI 分数校正、教师修订和写回遵循冻结 rubric 版本及评分细则开关。

## Impact

- 影响作业 rubric schema、分值计算与校验、发布门禁、evaluator 输出 schema、教师修订、评分写回和历史数据兼容。
- `add-guided-assignment-rubric-authoring` 与 `redesign-assignment-authoring-workspace` 依赖本 change 的评分结构。
