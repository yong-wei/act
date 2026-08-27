## Context

当前 planner 同时处理课程上下文、资源候选、先修关系、资格、评分、修复、路径持久化和解释。`src/lib/act-prerequisite-path-planner/` 另有 contracts、resource selection 和 planner 入口，多个 API 直接依赖内部类型或 helper。canonical spec 已要求 constrained、explainable、no-RL 的规划，但尚未形成一个可证明的 Personalization application boundary。

本 change 依赖 learner-state reducer 和 control-correction plugin，原因是 planner 只能消费归一化 learner state、goal context 和插件提供的课程策略；它不应重新读取 Prisma、Assessment 原始答案或硬编码课程 ID。

## Decisions

### One application use case

公开入口为 `PlanLearningPath`，输入为服务器解析的 learner/goal/path revision 与受治理的规划选项，输出复用现有 `AdaptiveLearningPathPlan` / `LearningPath` 合同。route、advisor、candidate batch 和 Konling 只负责认证、输入校验、响应适配和错误映射，不再编排 planner 内部阶段。

### Explicit pipeline stages

每个阶段是独立 port/strategy，按固定顺序由 application orchestration 调用：

1. `GoalContextLoader` 读取 Personalization goal、learner state、插件上下文和当前路径 revision。
2. `CandidateProvider` 从 canonical resource/candidate batch/plugin 来源发现候选，并保留 provenance。
3. `EligibilityPolicy` 仅判断不可违反的硬资格、先修、权限、资源状态和终点约束。
4. `RankingStrategy` 只对已合格候选做可解释的软排序，不把推荐偏好变成资格。
5. `ConstraintRepair` 以确定性规则修复容量、依赖、重复和终点覆盖；不能偷偷引入不合格节点。
6. `PathAssembler` 生成现有 canonical path 节点、revision 和 append-only 变更记录。
7. `ExplanationBuilder` 生成基于候选 provenance、资格和排序结果的学生/教师安全解释。

阶段不得直接依赖 Prisma、Next、React、Assessment 原始答案或另一个 planner；必要的读取和写入通过 ports/adapters 完成。

### Authority and compatibility

硬资格在 `EligibilityPolicy`，软推荐在 `RankingStrategy`；客户端、recommendation engine、解释文本和普通浏览不能授予资格、mastery 或完成。输出字段和已有 path evidence、terminal validation、stale revision/concurrency 语义保持兼容，路径历史只追加不覆盖。

候选 batch、control-correction 和现有 resource/knowledge contracts 作为既有模型复用。课程差异只来自注册 plugin，不在通用 planner 中增加 course ID、lesson ID 或 Arena task 常量。Arena 官方 evaluator 仍是评估权威。

### Deletion gate and rollback

迁移前先建立当前 HEAD 的 import/call graph 和输出 characterization fixtures。只有所有生产调用者改用 `PlanLearningPath`、阶段/域测试通过、架构规则证明 `src/lib` planner 无导入且无 re-export 后，才删除旧文件。历史数据不重写；代码回滚可以恢复本 change 前版本，但运行时不保留第二条 planner 路径。

## Risks and mitigations

- 输出顺序或评分漂移：以现有 fixture 做阶段级 parity，对 hard/soft 边界单独测试。
- 插件缺失造成错误降级：缺失或过期插件显式返回 unsupported/limited，不静默采用通用课程 ID。
- 并发或旧 revision 写入：沿用 canonical revision/token 检查，组装前拒绝 stale input，历史只追加。
- 解释泄露原始答案或内部实现：ExplanationBuilder 只消费治理后的 provenance 和安全字段。
