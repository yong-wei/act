## Why

`/ai` 当前在生产学生页面中使用固定的学习时长、能力、任务、成就、实验和推荐指数样例。学生无法区分演示数据与自己的学习事实，这会把没有证据支持的内容误认为个性化陪伴结论，违背项目“AI 只能基于真实学习证据提供支持”的课题边界。

现有 Learner State Service 已提供服务端拥有的学习证据、可用性、置信度和限制信息，但 AI 工坊尚未消费该服务。现在应把 `/ai` 接入该服务，并在证据缺失、过期或不可用时呈现诚实且可行动的学生状态。

## What Changes

- 从当前认证会话读取服务端 Learner State，不接受客户端画像字段作为权威来源。
- 移除生产页面中的 `sampleProfile`、`sampleTasks`、`sampleAchievements`、`sampleExperiments` 和 `sampleJournals` 默认数据。
- 将服务端学习证据投影为 AI 工坊可消费的脱敏 DTO，保留可用、无记录和不可用三种状态、证据数量、置信度和下一步行动。
- 对没有独立受治理来源的时长、成就、任务、实验、推荐指数和解锁状态显示明确的“暂无已验证记录”状态，不使用合成零值或样例值。
- 保持现有报告反馈任务上下文和普通 `/ai` 路由兼容，不改变正式成绩、排行榜、LearningFact 或画像写回边界。
- 增加服务端投影、组件状态和 `/ai` 页面回归测试，并补充桌面端与 320px 浏览器验收。

## Capabilities

### New Capabilities

- `ai-workshop-evidence-projection`: 定义 AI 工坊使用服务端学习证据、状态和限制信息的页面投影契约。

### Modified Capabilities

- `adaptive-learning-center-ui`: `/ai` 的学生视图必须使用证据支持的状态，证据不足时显示学生可理解的限制和下一步行动，不得展示未标注样例数据。
- `adaptive-learner-state-service`: AI 工坊作为学生消费者只能读取服务端拥有的学习状态，且必须保留证据可用性、置信度和隐私范围。

## Impact

- Affected route: `src/app/ai/page.tsx`。
- Affected components: `src/features/ai/personal-learning-center.tsx` 及其 dashboard、compass、task、experiment、journal 子组件。
- New server projection helper and focused tests under `src/features/ai` / `src/app/__tests__`。
- No new database migration and no new recommendation algorithm. Existing adaptive learner-state service remains the sole authority.
