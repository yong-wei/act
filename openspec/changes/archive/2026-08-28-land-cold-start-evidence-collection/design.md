# Design: Land cold-start evidence collection

## Context

Planner 已能为 `NO_EVIDENCE` / 冷启动返回可执行 starter path，决策证据也在生成时冻结。缺口是：不足状态仍按总证据数二分，采集活动没有独立质量语义，新建路径也无法说明哪些受治理采集改变了资源组合、难度、节奏或检查点。

## Goals / Non-Goals

**Goals:**

- 分维判断掌握、能力、偏好和新鲜度是否不足。
- 用现有诊断、资源完成和仿真/评测权威完成采集，不新建考试系统。
- 采集只作用于后续新建路径；继续原路径使用冻结快照。
- 弱事件 fail-closed：点击、浏览、聊天、未完成、冲突或放弃保持低置信或未知。

**Non-Goals:**

- 不新增个人中心画像字段，不从个人中心页面抓取展示数据。
- 不把采集结果直接写成 mastery。
- 不引入 contextual bandit、强化学习或长期记忆策略。
- 不改写历史路径、历史学习事实或决策快照。

## Decisions

### 1. Dimension status is projected, not stored as a new portrait field

A pure projector reads the current server-owned learner-state snapshot and classifies four dimensions: `mastery`, `ability`, `resource-preference`, `freshness`. Missing, low-confidence, stale, partial, or empty coverage is `insufficient`. The projector does not write profile fields.

### 2. Collection activities wrap existing governed work

Activity types are `short-diagnosis`, `resource-trial`, and `short-simulation`. Each record has goal identity, resource identity, completion, quality, and confidence. Completion is inferred from governed LearningFact / assessment / official simulation-or-Arena outcomes. Page view, click, chat declaration, and incomplete attempts are rejected.

### 3. Authority boundaries stay with existing engines

Only Assessment / official Arena / governed simulation rules may affect mastery. Collection records that lack that authority MAY raise a dimension to low/medium confidence for *future new paths*, but MUST NOT write mastery. Abandoned, failed, or conflicting records stay `low` or `unknown`.

### 4. New path vs continue original path

`new` generation reads the latest trusted collection-derived dimension status and records impacts on resource mix, difficulty/rhythm, or checkpoints in decision evidence. `continue` restores the original path snapshot and MUST ignore later collection records.

### 5. Student copy is client-safe

Limitation and activity copy live in a module without Node builtins. The adaptive-practice client page MUST NOT import the candidate-batch server module or other Node-only planners.

## Risks / Trade-offs

- [Risk] 单次采集就把路径说成高置信个性化。→ 单次受治理完成最高 `medium`；高置信仍走既有证据阈值。
- [Risk] 采集面板把服务端模块打进浏览器。→ 文案与投影输入保持纯函数，页面只消费 client-safe 模块。
