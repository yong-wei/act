## Why

微干预当前保存资源打开、提示请求、完成和独立验证结果，但这些事实不会进入掌握度或后续路径。若直接把“打开资源”或一次通过等同于掌握，会污染学习画像；若完全不使用验证结果，又无法形成跨会话的自适应闭环。

## What Changes

- 建立微干预证据投影，只把独立验证结果作为候选学习证据；资源打开、提示请求和完成标记仅作为参与上下文。
- 将证据绑定学习者、课程、目标、规范知识节点、来源错题、干预、验证题内容身份、捕获修订和算法版本。
- 规定质量权重、重复验证、时间衰减、冲突处理、撤销/重放和小样本边界。
- 掌握度和路径只消费经过治理的投影；单次微辅导通过不得直接确认终结性掌握或绕过 readiness/terminal validation。
- 保留原始答案、提示正文和用户标识的私有边界，公开报告仅输出抑制后的聚合统计。

## Capabilities

### New Capabilities

- `micro-intervention-learning-evidence`: 定义微干预结果向学习事实、掌握度和路径规划提供证据的身份、质量和隐私合同。

### Modified Capabilities

- `micro-intervention-outcomes`: 微干预结果提供不可变、可重放的验证证据投影，而不是直接修改掌握度。
- `adaptive-mastery-state`: 掌握度只消费满足身份、质量、重复和冲突规则的微干预证据。
- `adaptive-learning-path-planning`: 路径规划使用投影后的证据，并保留阶段门禁和低置信度 fail closed 行为。
- `learning-fact-quality-weight`: 为独立微干预验证和仅参与事件定义不同证据等级。
- `canonical-knowledge-learning-fact-identity`: 微干预证据绑定受治理学习目标和规范知识节点身份。

## Impact

- 影响微干预结果、学习事实 outbox/投影、掌握度重算、路径规划、数据治理报告和隐私抑制。
- 不让资源浏览、AI 提示或一次验证直接解锁终结性掌握；不改写历史答题或微干预记录。
