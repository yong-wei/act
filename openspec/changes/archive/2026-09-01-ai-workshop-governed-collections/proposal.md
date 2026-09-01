## Why

`/ai` 已移除虚假样例画像，但生产页面仍未向 `PersonalLearningCenter` 传入真实的任务、里程碑、成就、实验和学习日志，导致有记录的学生也长期看到空面板。AI 工坊需要复用现有受治理学习来源，将这些集合按学生身份和来源状态投影为可追溯的学习过程记录，同时继续避免把候选、草稿、预览或推断结果伪装成个人事实。

## What Changes

- 为 AI 工坊建立服务端拥有的受治理学习集合投影，分别返回任务、路径里程碑、成就、实验和学习日志。
- 每个集合独立保留 `available`、`empty` 或 `unavailable` 来源状态、学生安全来源说明和可达行动；一个来源可用不得授权其他集合显示零值或个人记录。
- 学习任务仅包含已发布给当前学生的作业或学生已采用并持久化的路径任务；里程碑仅来自持久化路径节点。
- 实验仅包含当前学生满足展示资格的仿真、控制工作台或 Arena 记录；成就仅来自独立持久化的达成事实。
- 学习日志仅包含学生明确保存并进入正式记录生命周期的反思、伦理或成长记录；Copilot 候选和可编辑草稿不得自动进入日志。
- 复用现有作业、Learner State、档案证据、成长记录和仿真/Arena 来源，不新增 LearningFact，不改变画像、评分、排行榜、任务完成或草稿晋升规则。
- 增加来源隔离、空/不可用状态、身份授权、去重排序和 AI 工坊桌面端/320px 浏览器验收。

## Capabilities

### New Capabilities

- `ai-workshop-governed-collections`: 定义 AI 工坊五类学生可见学习集合的权威来源、资格、独立状态、可追溯身份和禁止推断边界。

### Modified Capabilities

- `ai-workshop-evidence-projection`: 扩展服务端学生安全 DTO，使其携带按来源独立治理的任务、里程碑、成就、实验和日志集合，而不暴露原始证据或内部诊断字段。
- `adaptive-learning-center-ui`: AI 工坊在集合有合格记录时展示真实学习过程，在空或不可用时展示对应状态和行动，不再让生产页面长期停留在默认空数组。

## Impact

- Affected route: `src/app/ai/page.tsx`。
- Affected projection and components: `src/features/ai/ai-workshop-evidence.ts`、`src/features/ai/personal-learning-center.tsx` 及任务、路径、成就、实验、日志子面板。
- Reused server sources include `studentListAssignments`、Learner State `pathContext`、受治理档案证据、成长记录、`SimulationLog` 和 `ArenaSubmission`。
- Focused server projection, authorization, component and Playwright tests are required; no new scoring algorithm or learner-state write path is introduced.
