## Context

普通 Copilot 请求同时携带 `pageContext` 与 `userProfile`。前者是页面定位信息，后者当前由客户端固定生成。`/api/ai/chat` 在没有完整受治理运行时模式时，会把二者直接传给 `buildKonlingSystemPrompt`。已有 learner-state、Portrait v2 和 Evidence Copilot 能力可作为服务端事实来源，不能再由浏览器复制一份画像语义。

## Goals

- 任何个性化画像字段都由服务端认证身份和受治理状态决定。
- 伪造、替换或删除客户端画像字段不会改变当前学生的服务端画像事实。
- 缺失、低置信度和服务不可用状态能够被 Copilot 和页面准确表达。
- 保留页面主题、课程步骤和会话历史等非画像上下文的现有行为。

## Non-Goals

- 不重写 Portrait v2 或 learner-state 的计算算法。
- 不新增画像维度、推荐算法或长期记忆模型。
- 不把聊天内容、页面点击或客户端声明写入 LearningFact、成绩、排行榜或学习画像。
- 不重新实现 #1454 的 AI 工坊证据页面或 #1563 的 Evidence Copilot 专用证据投影。

## Decisions

### Separate navigation hints from learner facts

客户端允许发送有界的页面定位字段。服务端只将这些字段用于选择课程辅导场景；客户端 `userProfile` 中的姓名、学习风格、认知水平、能力向量、班级和舰队字段不得直接进入系统提示词。

### Resolve the profile on the server

在认证会话建立后，服务端调用现有受治理学习状态/画像投影读取能力，以会话用户为唯一作用域构造学生安全画像。读取失败时返回受控的 unavailable 状态；无证据时返回 cold-start 或 missing 状态，不能使用固定的 0.5 能力向量作为事实。

### Keep the generic fallback useful

当服务端画像不可用时，仍可根据服务端认可的课程主题、步骤和知识类型回答通用问题。系统提示词应明确个性化受限和禁止能力断言，并提供真实可达的学习证据采集或复习行动。

### Verify at the prompt boundary

测试同时覆盖请求解析、服务端画像投影和最终 system prompt：恶意客户端画像不能改变身份或能力上下文；合法受治理画像可以进入；缺失画像不会产生默认个人事实；普通无画像字段请求保持兼容。

## Data flow

1. 浏览器提交消息和有界页面定位信息。
2. `/api/ai/chat` 验证认证会话，忽略或拒绝客户端画像字段。
3. 服务端读取当前用户受治理画像，并附带状态、来源限制和置信度。
4. 提示词构建器只接收服务端学生安全投影和页面定位信息。
5. Copilot 输出学习解释或行动建议，不产生官方学习事实。

## Verification

- 覆盖伪造 `userProfile.id`、能力向量和学习风格的服务端回归。
- 覆盖无画像、画像不可用和有效画像的提示词边界测试。
- 覆盖普通 `/ai/copilot` 课程问答及认证归属。
- 运行相关 TypeScript、单元/API 测试、浏览器验收、严格 OpenSpec 校验和 `git diff --check`。
