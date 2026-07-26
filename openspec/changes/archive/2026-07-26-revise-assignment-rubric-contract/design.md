## Context

Canonical assignment rubric requires every subjective question to have performance levels and permits two decimal places. The agreed contract instead treats a natural-language scoring standard as the default grading basis and makes detailed levels optional per scoring item. Authoring and grading must consume the same frozen rubric version, but only AI drafts produced with detailed levels are constrained by a selected level.

## Goals / Non-Goals

**Goals:**

- Represent each question rubric as ordered scoring items with stable identities, maximum points, a scoring standard, and optional detailed levels.
- Use one decimal place consistently and require each scoring item maximum to be at least 1.0.
- Derive gap-free level ranges from editable upper bounds with a defined boundary rule.
- Make five-level, two-level, incremental add, sorting, and score clamping deterministic.
- Preserve existing teacher content when applying shortcuts unless confirmed removal is required.
- Select an evaluator output schema from the frozen detailed-rubric flag and keep teacher score revision independent from AI level clamping.

**Non-Goals:**

- 不实现 AI 填写评分细则。
- 不决定作业编辑页整体布局。
- 不让默认评分细则成为所有题目的强制要求。

## Decisions

### 1. 评分项是汇总与发布校验的基本单元

每个评分项保存稳定 id、名称、满分、评分标准、是否启用评分细则和有序评价级别。评价级别保存名称、最高分值、评分准则和派生最低分值；最高级别上限始终取评分项满分。

### 2. 所有分值使用一位小数的十进制定点语义

持久化和计算使用十分之一分的整数或等价 Decimal 约束，避免浮点边界误差。向上保留一位小数用于默认百分比和比例扩展；启用评分细则的 AI 建议分数先按所选级别合法区间校正，再保留一位小数。教师人工修订只校验一位小数及零分至评分项满分，不复用 AI 级别夹取。

### 3. 上边界属于较高级别

按最高分值降序排列级别。最高级别区间包含其上下界；其余级别的上界不包含、下界包含，最低级别下限为零。例如相邻上限 90.0 与 80.0 时，较低级别最高可记 89.9。

### 4. 快捷设置以内容保留为默认

五级制和两级制只对尚未由教师编辑的空白细则应用标准名称和标准百分比。已有内容按当前位置完整保留；减少数量只删除末尾项且必须先确认，增加数量按最后两个上限的比例扩展。首次只有一个级别时，缺少比例基准的快捷设置使用对应标准百分比补足。

### 5. 增量新增使用固定命名和比例退化规则

依次使用“优秀、良好、中等、及格、不及格”，其默认上限依次为满分的 100%、90%、80%、70%、60%，均向上保留一位小数。首次开启仅建“优秀”，覆盖零至满分。第六个及以后“自定义”级别才沿用最后两个上限的比例外推；一位小数后重复则比上一等级低 0.1，无法形成至少 0.1 的区间时拒绝。

### 6. 发布条件随细则开关变化

关闭细则时评分标准必填；开启细则时每个级别评分准则必填，评分标准可空。默认名称与分值是真实可发布值，首次输入直接替换而非拼接。

### 7. 批改 schema 绑定冻结 rubric 版本

批改任务冻结 rubric 版本和每个评分项的评分细则开关。关闭时 evaluator 输出评分项 id、建议分数、理由、置信度、证据与限制，不产生或要求 level identity；开启时使用包含 level identity 的 schema，并在持久化 AI 草稿前执行级别区间夹取。历史 rubric 继续按其冻结版本选择兼容 decoder，不用当前草稿结构重解释。

教师审批保存独立的人工分数与 AI/教师差异。人工分数只需一位小数并位于零分至评分项满分之间；写回消费教师批准值及冻结 rubric 版本。

## Risks / Trade-offs

- [旧两位小数数据无法无损变为一位] → 迁移 dry-run 报告舍入差异，按统一规则转换并保留旧发布快照。
- [快捷设置误删教师内容] → 减少级别必须显示将删除的完整记录并二次确认。
- [比例扩展在低分项快速耗尽] → 重复值按 0.1 退让，不能形成合法区间时明确拒绝。
- [AI 分数落在开区间边界] → 仅对启用评分细则的 AI 草稿使用定点 clamp helper。
- [教师人工分数与 AI 所选级别不同] → 保留差异并按评分项总边界校验，不把 AI 级别约束强加给教师。

## Migration Plan

1. 增加新版评分项和评价级别 schema、精度约束及版本标识。
2. dry-run 转换可映射旧 rubric，报告两位小数舍入与无法映射记录。
3. 新草稿使用新版合同；旧发布修订保持不可变快照和原评分解释。
4. 为关闭/开启评分细则分别上线 evaluator schema，并按冻结 rubric 版本更新 AI 草稿、教师修订、成绩汇总和写回消费端。
5. 回滚时停止创建新版草稿，但不将已发布新版 rubric 反向写回旧结构。

## Open Questions

- 无；AI 生成行为由 `add-guided-assignment-rubric-authoring` 单独定义。
