## Why

当前“AI 生成题”接口实际使用固定模板和进程内存储，却返回 `ai_generated`；生成结果无法进入候选审核、目录发布或重启后的持久状态。平台需要把临时练习生成与可发布题目生产严格分开，并建立 AI 不可自行批准的内容治理流水线。

## What Changes

- 建立持久化题目候选合同，记录生成方式、provider/model、prompt/config、输入知识来源、内容哈希和所有派生版本。
- 对答案正确性、干扰项唯一性、公式/图形渲染、知识节点对齐、难度、泄题和安全风险执行确定性预检与人工审核。
- 只有人工批准且发布到版本化题目目录的候选才能进入 path-eligible 或正式验证用途；模型和机器规则不得设置最终 reviewed 状态。
- 建立候选修订、拒绝、退役、发布回执和回滚链路，并保持学生答题快照不可变。
- **BREAKING**：纠正模板生成接口的 `ai_generated` 误标，使用可验证的 generation kind/source discriminator；消费者必须迁移到新字段。

## Capabilities

### New Capabilities

- `adaptive-assessment-generation-review-publication`: 定义模板/AI/人工候选的生成溯源、自动预检、人工审核、目录发布和回滚合同。

### Modified Capabilities

- `adaptive-assessment-item-catalog`: 仅接收具备完整候选 lineage、人工批准和发布回执的生成题，并保留不可变内容身份。

## Impact

- 影响生成题 API、候选持久化、AI provider 调用、审核工作台、题目目录导出和答题时快照。
- 不允许运行时临时生成正式答案或验证题，不允许 AI 自审自发，不把原始 prompt、模型响应或学生数据写入公开治理报告。
