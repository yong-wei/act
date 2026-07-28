## Why

附件能否进入 AI 批改必须由清楚、可审计的处理政策决定，而不能由本地转换结果静默兜底。二进制附件、直接可读文本和外部处理受限场景需要统一的证据拼装与不完整证据门槛。

## What Changes

- PDF、DOC、DOCX、PPTX、PNG 和 JPEG 仅通过 Mathpix 形成自动批改可理解内容，不使用 MarkItDown、OOXML 或其他本地语义提取兜底。
- Markdown 与纯文本附件由平台直接读取，不发送 Mathpix。
- 外部处理政策允许时才发送 Mathpix；政策不允许或 Mathpix 最终失败时保留原件供人工批阅，并标记附件理解缺失。
- 自动批阅按学生正文、正文中内嵌图片对应位置、再按学生排列的独立附件顺序拼装证据。
- 部分附件缺失时可以生成证据不完整的 AI 建议，但必须列出缺失附件，并经教师确认后才能形成成绩。
- 通过 dry-run/apply 治理既有本地二进制转换：已批准历史保持不变，未批准链路标记为 legacy-ineligible/blocked 并清除新 evaluator 与写回 readiness。
- 不包含教师原件展示界面。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `document-rubric-grading-workbench`: 修改作业附件转换路由、外部处理门禁、评分证据拼装和不完整证据的教师确认要求。

## Impact

- 影响答案证据规范化、Mathpix 适配器、直接文本读取、外部处理策略、批改输入拼装、历史本地转换迁移和教师确认门禁。
- 实现依赖 `unify-assignment-response-contract` 的附件集合与顺序；`refine-assignment-review-evidence-presentation` 消费本 change 的缺失证据状态。
