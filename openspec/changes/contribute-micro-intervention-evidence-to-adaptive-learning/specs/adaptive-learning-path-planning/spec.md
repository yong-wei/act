## ADDED Requirements

### Requirement: 路径规划只消费治理后的微干预证据摘要

路径规划 SHALL 仅消费微干预 evidence projector 生成的 confidence、freshness、quality、identity 和 limitation 摘要，不得读取原始答案或由参与事件直接改变路径。低置信度、冲突或 stale 微干预证据 MAY 触发补救或再验证，但 MUST NOT 绕过 readiness、checkpoint 或 terminal-validation 门禁。

#### Scenario: 当前验证证据支持路径调整

- **WHEN** 受治理摘要显示当前节点存在有界、足够新鲜的微干预验证证据
- **THEN** 规划器 MAY 将其作为解释性输入调整后续练习或补救优先级
- **AND** 决策 SHALL 记录所用 evidence summary 和算法版本

#### Scenario: 证据低置信度或冲突

- **WHEN** 摘要标记重复、过期、冲突或身份漂移
- **THEN** 规划器 SHALL 保留/增加评估门禁或请求再验证
- **AND** 不得将路径节点直接标为已掌握
