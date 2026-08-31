## Why

8 类场景、24 次重复的教师学情诊断仿真实验（Issue #1728）显示系统存在系统性过度诊断：知识节点微平均精确率仅 62.07%（召回 85.71%、宏平均 F1 65.83%），健康与复杂场景中"相对较低但仍处于正常范围"的节点被模型判为薄弱，教师看到的干预范围偏大。

根因是生成契约缺少薄弱判定约束：诊断 system prompt 只约束语言、归因、证据引用与格式，不包含任何薄弱判定标准；生成后的确定性校验链（语言门、证据引用门、知识节点归因门）也没有薄弱判定的最小证据要求。模型只依据原始分数自行决定"什么算薄弱"，自然倾向于把相对排序靠前的节点全部报出。

## What Changes

- 诊断 system prompt 增加薄弱判定分层指令：知识点薄弱必须锚定绝对弱势证据（长期未开始或进度显著落后且未完成）；班级内相对较低但处于正常范围的节点不得判为薄弱；全部节点正常时允许并鼓励输出空 findings 并在 summary 说明"未发现明确薄弱节点"；作业与测评证据冲突时降低结论强度并写入 limitations，不得单方面下强结论。
- 生成后新增确定性薄弱判定校准门禁（模型行为缺陷、走既有重试预算）：知识点 finding（携带 knowledgeNodeId 或引用 knowledge-progress 证据）所锚定的节点必须满足最小绝对弱势证据——班级诊断时该节点上弱势证据行（NOT_STARTED，或进度 < 40 且未完成）不少于 `max(3, ceil(20% × 有进度记录的学生数))`；学生诊断时目标学生该节点行必须为弱势行。不满足即拒绝该次输出，不得持久化。
- 数据覆盖降级：知识点 finding 引用节点的进度行覆盖率不足全体学生时，报告 confidence 不得为 `high` 且 limitations 必须说明数据缺失影响；确定性校验该约束。
- 保持既有知识节点 ID 归因、证据引用、中文输出与 sourceCoverage 治理规则不变；投影端确认空 findings 的展示路径表达"未发现明确薄弱节点"。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `teacher-diagnosis-generation-governance`: 增加薄弱判定校准要求——最小绝对弱势证据、正常节点禁判、健康场景空 findings fail-closed 与数据覆盖降级。

## Impact

- 受影响代码：`src/lib/diagnosis-generation-provider.ts`（system prompt、校准校验）、`src/lib/diagnosis-generation-worker.ts`（新失败分类）、`src/features/teacher/teacher-diagnosis-report-history-projection.ts`（空 findings 展示，如需）、相关测试。
- 行为影响：不满足最小证据的知识点薄弱判定在生成时被拒绝并按模型行为缺陷重试；健康场景知识节点级假阳性获得结构性下界（零）；"学完但整体测评差"等班级整体问题继续通过非知识类发现表达，不受节点门禁限制，不损失召回通道。
- 验证：确定性校准校验的单元测试（健康、阈值边界、单弱点、多弱点、证据冲突、数据缺失场景）；既有语言、归因、引用测试保持通过。冻结基准集上的真实模型精确率/召回率复测由 #1729 的评测门禁承载。
