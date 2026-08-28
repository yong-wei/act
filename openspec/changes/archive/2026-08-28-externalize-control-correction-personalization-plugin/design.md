## Context

当前 `adaptive-learner-state-service.ts` 同时声明 `CONTROL_CORRECTION_COURSE_ID_VALUES`、Arena task IDs、9 个 goal dimensions、source requirements、privacy 和 goal-slice registry，并从 `adaptive-learning-path-planner.ts` 导入 capability targets。路径 advisor、Konling context、profile/recommendation、Arena 和课程页面再把 `courseId`/`lessonId` 传入这些通用入口。课程证据的读取、资格与持久化策略因此散落在 service、data-governance 和 feature 层。

`reduce-personalization-learner-state` 已将 learner-state 计算收敛为 read-port 驱动的纯 reducer；本 change 只把课程差异从通用层外置，继续复用现有 `control-correction` canonical contracts、LearningFact/Assessment identity 和路径证据规则。

## Goals / Non-Goals

**Goals:**

- 由一个 plugin registry 负责 goal → plugin identity、版本、课程/lesson/Arena 映射和 evidence policy。
- 使 control-correction plugin 可独立测试、演进和回滚，通用 Personalization 不知道具体课程 ID。
- 让 plugin 通过 read/write ports 参与 evidence projection、persistence strategy、privacy 和 confidence，而不越权写原始事实。
- 迁移所有真实调用者并删除旧常量、重复 registry 和课程分支。

**Non-Goals:**

- 不创建第二个 goal registry、第二个课程配置真源或平行 evidence store。
- 不改变 control-correction 维度、评分、Arena 官方评测、path completion 或既有学生/教师字段含义。
- 不允许客户端选择任意 plugin、伪造 course/lesson/task 绑定或直接提交能力贡献。
- 不在本 change 完成 planner 拆分、recommendation/intervention ownership 或旧 adaptive entrypoint 全量退役。
- 不部署、不激活生产 plugin 版本。

## Decisions

### 1. 一个版本化 registry 解析 goal plugin

定义 `PersonalizationGoalPlugin` 与 `PersonalizationPluginRegistry`。registry 只暴露 `goalId`、plugin version、受信任的 context resolver、dimension contract、evidence source descriptors、privacy classes、confidence policy 和 persistence/read-port adapters。control-correction plugin 持有当前课程/lesson/Arena task 的映射及其 manifest/source refs；通用服务只传递规范化 `goalId` 和已验证的 context。

```text
external course/lesson/task hint
  -> registry plugin resolver
  -> canonical goal context + plugin version
  -> learner-state/path/recommendation policies
```

映射冲突、未知 ID、版本漂移或多 plugin 命中必须失败关闭；不能用默认 control-correction 或关键词猜测替代。

### 2. Plugin 是策略与适配边界，不是事实所有者

插件可以声明怎样从 Learning Record/Assessment read ports 选择 control-correction evidence、如何映射维度、怎样生成 privacy-safe rationale，以及何种 server-side persistence adapter 可写回结果。Learning Record 仍拥有 LearningFact/event，Assessment 仍拥有评分/attempt/mastery authority；plugin 不直接调用 Prisma、不写原始答案、不自授予 mastery。

持久化策略必须带 plugin version、source coverage、confidence、idempotency key、subject scope 和 evidence refs。重试返回同一结果，历史 revision 不因 plugin 更新而重写。

### 3. 通用 Personalization 不保留课程 ID

迁移后 `adaptive-learner-state-service`、reducer、recommendation 和 planner 只能依赖 `GoalContext`/plugin contract；`CONTROL_CORRECTION_COURSE_ID_VALUES`、`CONTROL_CORRECTION_ARENA_TASK_ID_VALUES` 及 lesson 字符串只能存在于 plugin 包。外部请求中的 course/lesson/task 先由 route/application 完成授权和格式验证，再交给 registry；客户端不能选择 plugin version 或 evidence source。

### 4. 与现有 goal/path registry 合并而非并存

现有 `ADAPTIVE_GOAL_SLICE_REGISTRY`、`ADAPTIVE_LEARNING_GOAL_DEFINITIONS` 和 control-correction constants 作为迁移输入。迁移时选定一个 Personalization plugin registry identity，旧 registry 只保留必要的读取 adapter 直到所有调用者切换，随后删除其公开权威和 re-export；不允许两个 registry 对同一 `goalId` 给出不同策略。

### 5. 缺失插件只返回受治理限制

如果目标未注册、plugin disabled、证据源不可读或上下文无法验证，API 返回 `unsupported-goal`/`limited-confidence`，并保留安全的 limitation reason。不得回退到硬编码课程 ID、全局默认维度、原始表扫描或假定 control-correction。

## Risks / Trade-offs

- [映射移动后课程入口丢失] → 用 manifest/source refs、旧新 registry parity 和 route fixtures 覆盖每个既有 course/lesson/task binding。
- [plugin 变成新的上帝模块] → contract 只允许 context/evidence/policy/adapter，通用 orchestration 留在 application；registry 禁止直接暴露 Prisma。
- [插件版本变化重算历史状态] → 所有写入绑定 plugin version 和 evidence revision，历史 projection 只读旧 identity，更新只影响新计算。
- [未知 goal 被误判为 control-correction] → resolver 对未知、冲突和停用状态显式返回 unsupported，负向测试禁止默认 fallback。
- [课程策略泄露教师或 Arena 数据] → plugin 的 field/privacy contract 与 role projector 复用 canonical governance，原始 trace、答案和隐藏评测保持 restricted。

## Migration Plan

1. 验证 reducer、charter/dependency contract 和现有 control-correction canonical specs，冻结 hardcoded ID 与调用者分母。
2. 定义 plugin interface/registry，先把 control-correction 映射和 evidence policy 迁入单一 plugin，并用 parity fixtures 证明输出不变。
3. 迁移 learner-state、path/advisor、recommendation、Konling、Arena/lesson 和 worker adapters；所有跨域调用只读 plugin public contract。
4. 删除通用硬编码、旧 registry authority 和 forwarding exports，更新台账，运行 plugin/Personalization/Learning Record/Assessment/path domain suites、typecheck、strict validation 和 diff check。
5. 回滚时选择上一 plugin version 并停止新写入；不删除或重写历史 facts、attempts、snapshots、Arena evaluation 或路径历史。生产激活另行授权。

## Open Questions

无。具体 registry 文件位置服从 dependency contract 的领域目录；不得为了保留旧导入路径新增长期 facade。
