## Why

用户诉求：工程图谱应提供不依赖本项目教学设计的知识学习顺序（不随教学编排改变的先后修关系）。上游 r6 已铸造 79 条 `prerequisite` ProjectedLink（DomainConcept–DomainConcept、有向、无环、带工程出处），但本仓库的先后修链路消费不了它们：

1. **发布合约断层**（#1270 时代）：`src/lib/teaching-projection/prerequisites/contracts.ts:54-63` 只允许 ACT_TEACHING 层发布 PREREQUISITE；ENGINEERING_RELATION 等来源类只做候选。现行 spec 已预留采用通道（「Engineering relation whose presentation family is `post-requisite` MAY be adopted as a REQUIRED teaching prerequisite with engineering provenance」），但 `prerequisite` 谓词在呈现族映射中没有条目，工程边连候选都成不了。
2. **候选生成空转**：当前发布 proj-d55c3ac4 的 139 条边全部 ACT_TEACHING/RECOMMENDED 且 candidates=0——候选生成路径从未产出工程候选。
3. **消费端硬过滤**：`src/features/personalization/path-planning/planner.ts:130-141` 硬性过滤 `layer=ACT_TEACHING`，任何未采用进教学层的工程顺序对规划器不可见。

上游已在 r6 完成其侧修复（U2）；剩余的是 ACT 侧采用与消费接线。

## What Changes

- 发布侧：`prerequisite` 谓词的工程关系纳入「post-requisite 族采用通道」——连接两个现行权威对象的工程 `prerequisite` 边可采用为 REQUIRED 教学先后修（工程出处随附），与既有 post-requisite 条款同构；候选生成器实际产出 ENGINEERING 来源候选（修掉 candidates=0 的空转）。
- 采用治理：采用/不采用逐条留痕（采用收据绑定 r6 快照身份与边身份）；教学设计证据与工程顺序冲突时教学证据优先，冲突记录为例外。
- 消费侧：路径规划对采用后的工程先后修边生效（排序约束与就绪门控）；planner 的层过滤语义不变（采用后即为 ACT_TEACHING 层），但规划诊断须能区分「教学编排顺序」与「工程学习顺序」来源。
- 重建先后修发布物（prerequisites store，新 proj-*），替换 proj-d55c3ac4。

## Capabilities

### Modified Capabilities

- `act-teaching-prerequisites`：采用通道从 post-requisite 呈现族扩展到上游铸造的 `prerequisite` 谓词；候选生成必须真实产出工程来源候选。
- `adaptive-learning-path-planning`：规划排序消费采用后的工程学习顺序，诊断区分顺序来源。

## Impact

- 代码：`src/lib/teaching-projection/prerequisites/`（contracts、publication、candidate 生成）、`src/features/personalization/path-planning/planner.ts`（诊断与来源标注）。
- 数据：`course-content/runtime/knowledge/prerequisites/`（新发布物与 selector）。
- 依赖：`adopt-v037-r6-authority-graph` 先行（79 条工程边进入分片/快照后才可采用）；与 `path-planning-consumes-teaching-projection`（#2046，教学设计消费）语义正交、与 `bind-path-candidates-runtime-assets`（#2055）无文件级冲突预期。
- 非目标：不改上游 bundle；不改 ACT 教学编排内容本身；不执行生产发布。
