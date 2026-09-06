## Why

当前课程教学投影 B′（`proj-d22e0cca`）有 1227 资源 / 2458 绑定 / 434 canonical，但覆盖远未闭合：例外账本积有 743 条（633 张知识卡无 canonical 身份、55 条课堂仿真无课次单元、16 条 lesson02 仿真单元未映射、28 条仿真无精确身份），讲义 3-9/5-5/5-6 与习题 5-6 因 coresByUnit 为空无法绑定，Franklin 整书 4 个 canonical（`ctc:v11g-*`）全部不在 overlay A 活投影（`proj-05984a0f`，376 core）内，信息图 161+1235 张完全未进投影，lesson/step 类型缺失，投影 core-nodes 被硬编码为空数组（`runtime-full-binding.ts:438`）。更关键的是例外账本当前没有任何消费者，`--allow-ledger 900` 只卡总量，不驱动缺口归零。图谱、路径规划与控灵因此继续跳过大量真实教学资源。

## What Changes

- **卡片身份闭合**：扩充 `teaching-projection/cards/card-crosswalk.jsonl` 覆盖 633 张未绑定卡（生成候选 + 独立语义评审）；改 `runtime-full-binding.ts:260-262` 消费 crosswalk 与卡 frontmatter `canonical_id`，替代对中文 slug 的无条件记账；同步补 `card-name-index.json` 中 4279 个未解析 canonicalKey。
- **信息图入投影**：`contracts.ts` 的 `TEACHING_RESOURCE_TYPES` 增加 `infographic`；restage 枚举 `infographs/nodes`（161 张，按 legacy node_id）与 `infographs/authority/nodes`（1235 张，按 canonical token 精确绑定）。
- **lesson/step 回归**：把 `src/lib/teaching-projection/active-inventory.ts` 的课次/步骤盘点重新并入 restage 管线。
- **core-nodes 喂回**：从 prerequisite 出版物 `core-nodes.json`（162 个 pathEligible core，159 个在 B′ 已有绑定）喂回投影 authoring，替代 `runtime-full-binding.ts:438` 硬编码空数组。
- **单元绑定缺口**：为 3-9 / 5-5 / 5-6 单元的 canonical 节点补教学绑定声明，使这三个单元的讲义与习题 5-6 可绑。
- **仿真关联升级**：Odyssey `level-data.ts` 关卡补 canonical 关联（替代硬编码 `relatedNodeIds: []`）；Arena `seed-challenges.ts` 的 `relatedKnowledge` 从 legacy 节点 id 升级为 canonical；`CLASSROOM_LESSON_UNIT` 对 lesson02 补映射或记显式永久例外。
- **Franklin 对齐**：crosswalk 中 Franklin 4 个 canonical 对准 overlay A core 内节点。
- **账本治理**：例外账本接入治理报告消费者；`--allow-ledger` 从单一总量阈值改为分类别配额，并随缺口闭合收紧。
- 已获用户授权执行必要的教学语义修改（卡片 crosswalk、仿真关联、单元绑定声明均含教学判断）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `runtime-teaching-resource-binding`：信息图作为资源类型入投影；卡绑定改为消费 crosswalk/frontmatter canonical_id；课堂仿真单元映射补全；例外账本从总量阈值改为分类别配额并接入治理消费。
- `act-teaching-projection`：投影 core-nodes 必须来自 prerequisite 出版物真源，禁止硬编码空数组；lesson/step 盘点并入投影 authoring。
- `canonical-knowledge-resource-binding`：活跃教学资源不得孤儿的覆盖闭合要求扩展到信息图、lesson/step 与全部任务仿真，例外账本必须闭合到零或仅剩显式豁免。

## Impact

影响 `scripts/knowledge/restage-runtime-teaching-bindings.ts`、`src/lib/teaching-projection/runtime-full-binding.ts`、`src/lib/teaching-projection/contracts.ts`、`src/lib/teaching-projection/active-inventory.ts`、`src/resources/interactive-learning/control-odyssey/level-data.ts`、`src/features/arena/data/seed-challenges.ts`、卡片 crosswalk/name-index 数据、投影 B′′ 发布产物与例外账本配额配置。不改 overlay A（domain-fragments）拓扑与活指针，不改 `engineering-graph` / `engineering-rag` 的无投影组合。教学资源文件不被 git 跟踪，涉及实际资源存在性的验收基于文件系统而非 git。本变更只交付数据与代码及本地验证；生产运行态发布步骤写入 tasks，执行时单独授权。
