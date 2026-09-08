## Why

`planLearningPath` 是 spec 规定的唯一路径装配用例，但其四个候选源（DB TeachingResource、运行态课次目录、运行态教材结构、`runtime-resource-projections.jsonl` sidecar）都不含教学投影 B′ 的 2458 条绑定：讲义、知识卡、视频、音频、习题、仿真、教材节的 canonical 绑定信号完全进不了候选池。同时 ResourceNode 无 exercise 类型、所有注册目标 `allowedResourceMix` 不含 video/audio，即便绑定存在也无法入选。路径规划因此只消费了教学资源的一个子集，控灵生成的路径无法包含讲义/卡/视频/音频/习题等真实教学资源。

## What Changes

- 新增教学投影绑定适配器作为第五候选源：读取活投影的 resources/bindings/cards-index，按确定性身份规则映射到既有 ResourceNode（`act:handout:*`→`runtime-handout:*`、`act:card:*`→`knowledge-card:*`、`act:video|audio:*`→`runtime-media:*`、`act:simulation:arena-task-*`→`arena-task:*` 等），canonical 绑定经 `mergeOverlappingSources` 按 id 合并为匹配/排序/解释信号；不动准入真源。
- `nodeMatchesGoal` 目标集合纳入 canonical 目标：经 cutover `denominator.json` 桥把 canonical id 映射回旧节点 id 后参与匹配；无桥映射时回退旧目标集合并报告限制，禁止模糊匹配。
- ResourceNode 类型与 mix 扩展：新增 `exercise` 类型；注册目标 `allowedResourceMix` 扩展 video/audio/exercise；评审批次扩容覆盖新增类型节点，评审通过后这些族才可入选。
- 候选池诊断按资源族报告计数（含教学投影绑定族）；适配器输入缺失或投影指针不一致时该族为空并把路径标记 limited，不伪造候选。
- 不接线 `planActPrerequisitePath`：只预留 CandidateProvider 端口形状，待 core-nodes 喂回与 REQUIRED 边数据成熟后另行评估。

## Capabilities

### New Capabilities

- `teaching-projection-path-binding-adapter`：教学投影绑定到路径候选的适配器契约——确定性身份映射、合并语义、canonical 信号用途边界、失败降级。

### Modified Capabilities

- `adaptive-learning-path-planning`：统一 ResourceNode registry 消费增加第五候选源；目标匹配纳入 canonical 目标；资源 mix 可含 video/audio/exercise；适配器来源节点不得绕过评审/审计准入。
- `personalization-path-planning-pipeline`：候选发现可消费教学投影绑定适配器作为 CandidateProvider 的一个候选源，适配器不得成为第二装配权威。

## Impact

- 适配器与装配点：`src/lib/konling-agent-runtime.ts`（`resolveAdaptivePathGenerationRegistry` 增第五族）、`src/lib/teacher-resource-node-data.ts`、`src/lib/resource-node-registry.ts`（类型枚举、`mergeOverlappingSources`）。
- 目标匹配与 mix：`src/features/personalization/path-planning/internal/assemble-plan.ts`、`src/features/personalization/path-planning/plugins/path-planning-policy.ts`。
- 治理输入：cutover `denominator.json` 作为只读 canonical↔旧节点 id 桥；`resource-node-path-readiness-review-batch.ts` 评审批次扩容。
- 依赖：Change 1（`complete-teaching-projection-resource-coverage`）产出闭合投影后适配器才有完整输入；与进行中变更 `explain-active-path-node-decisions` 协调解释面边界（该变更负责节点级决策投影，本变更只追加候选族计数与绑定来源信号，不改节点决策投影）。
- 不改路径持久化合同、不改 UI、不执行生产发布。
