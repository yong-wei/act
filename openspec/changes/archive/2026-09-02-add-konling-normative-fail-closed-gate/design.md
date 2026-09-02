## Context

`generic-chat` 已能把规范性问答标为 `verified` 或 `verification-required`，但该状态只在主意图等于 `normative-content` 时生效。主意图分类召回不足时，标准号、法规、认证和必须/不得类问题会落入其他意图，从而跳过安全降级。权威来源已经只能由 Citation Hydrator / Source Pack 在服务端生成；本变更不新增法规库。

## Goals / Non-Goals

**Goals:**

- 用独立检测器识别规范性风险，不依赖主意图分类结果。
- 缺少服务端确认的权威来源时强制 `verification-required`，即使意图被误分为事实解释或其他学习问答。
- 降级提示保留一般原理解释，同时写明证据缺口、可回答边界和核验建议。
- 客户端输入、提示注入或自报来源不能把回答抬升为 `verified`。

**Non-Goals:**

- 不实现外部法规/标准数据库，不扩展 Citation Hydrator 的来源集合。
- 不把所有包含“标准”字样的概念题一律拒答。
- 不在本变更中重做六类意图分类器或结构评分语义。

## Decisions

### 1. Independent detector sits beside intent routing

在 `buildKonlingStudyQuestionContract` 中根据最新用户问题独立判定规范性风险。命中标准号、法规、认证、官方规定或必须/不得/应当加约束对象时，即使 `answerIntent` 不是 `normative-content`，也将 `normativeGuidance` 设为 `verification-required`，除非已有服务端确认的权威引用。

不把检测器并入主分类器：分类器可以继续优化召回，安全门禁必须在分类失败时仍触发。

### 2. Verified status remains server-owned

继续只接受现有 `hasVerifiedNormativeCitation` 条件：`verified === true`、`resolver === 'official-reference'`、高置信、可导航 `citationTargetId` 与 `href`。这些字段只能来自服务端 citation context。客户端传入的 `verified`、提示词中的“已核验”声明，以及缺少官方 resolver 的自报来源一律不能抬升状态。

### 3. Prompt names the fail-closed envelope

`verification-required` 提示必须要求：标为需核验、列出证据缺口、说明可回答边界、给出核验建议；可以讲解一般原理，但必须区分事实、推断和待核验内容。Citation Guard 继续追加 `normative-guidance-verification-required`。

## Risks / Trade-offs

- [独立检测误伤一般概念题] → 不单凭“标准”字样触发；需要标准号、法规、认证、官方规定或义务性约束搭配。
- [检测器仍可能漏检隐式规范问题] → 这是纵深防御，不是分类器替代；漏检由后续分类修复处理，已命中项不得确定性断言。
- [模型忽略需核验提示] → 合同、metadata 和 Citation Guard 仍标记需核验，前端继续展示规范内容需核验，不以模型自觉为唯一边界。

## Migration Plan

1. 增加独立检测与错误路由测试。
2. 接线到 study-question 合同和降级提示。
3. 验证客户端绕过无效，再归档本 change。
4. 无数据迁移；回滚只恢复意图绑定的旧门槛。

## Open Questions

None.
