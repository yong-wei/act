## Context

三套教学存储继续分治：A 是 domain-fragments overlay（画布关系，活指针 `proj-05984a0f`，376 core / 374 关系）；B 是课程 Teaching Projection（资源/绑定/cards-index，当前 B′ = `proj-d22e0cca`）；C 是 prerequisites 出版物。本变更只做 B′ → B′′ 的数据层覆盖闭合，不改 A 的拓扑，不切消费方指针之外的任何运行时组合。

B′ 的缺口事实（均已核实）：

- 例外账本 743 条：633 张 authoring 卡 frontmatter 只有 `node_id`、无 `canonical_id`（`card-crosswalk.jsonl` 仅 4 行；`card-name-index.json` 仅 144 条，4279 个 canonicalKey 未解析）；55 条 `classroom-sim-without-unit` + 16 条 `classroom-sim-unit-unmapped`（全部 lesson02）；28 条仿真 `no-exact-identity`（12 Arena + 15 Odyssey + 1 workbench）。
- 讲义 3-9 / 5-5 / 5-6 与习题 5-6 文件存在但未绑定：`coresByUnit` 对这三个单元为空，没有任何 canonical 节点带该单元标记。
- Franklin 整书未进账本：crosswalk 的 4 个 canonical（`ctc:v11g-*`）全部不在 overlay A core（376 个）内。
- 投影 `coreNodes` 在 `runtime-full-binding.ts:438` 硬编码为空数组；真源在 `course-content/runtime/knowledge/prerequisites/releases/<pub>/core-nodes.json`（162 个 pathEligible core，其中 159 个在 B′ 有绑定）。
- 信息图完全缺席：`TEACHING_RESOURCE_TYPES`（`contracts.ts:45-60`）无 `infographic` 类型；运行态文件为 `infographs/nodes/*.png` 161 张（按 legacy node_id）与 `infographs/authority/nodes/*.png` 1235 张（按 canonical token）。
- 卡绑定对中文 slug 无条件记账（`runtime-full-binding.ts:260-262`），不读 `card-crosswalk.jsonl`；`active-inventory.ts`（lesson/step 盘点器）存在但本轮未并入。
- Odyssey `level-data.ts` 无任何知识节点字段，restage 硬编码 `relatedNodeIds: []`；Arena `seed-challenges.ts` 的 `relatedKnowledge` 是 legacy 节点 id；`CLASSROOM_LESSON_UNIT`（`runtime-full-binding.ts:35-45`）无 lesson02 映射。
- 例外账本当前无消费者；`--allow-ledger 900` 只卡总量，不区分原因类别，也不驱动闭合。

## Goals / Non-Goals

**Goals:**

- 重发布投影 B′′ 内资源类型齐全：讲义、知识卡、信息图、仿真、习题、视频、音频、教材、lesson/step 全部在场。
- 例外账本闭合到零或仅剩显式豁免项；`--allow-ledger` 改为分类别配额并随闭合收紧。
- 绑定继续只允许精确身份或一对一 crosswalk；卡片语义映射经生成候选 + 独立语义评审，禁止模糊匹配制造 BOUND。
- 投影 core-nodes、lesson/step 盘点从真源喂回，不留硬编码空数组。

**Non-Goals:**

- 不改 overlay A（domain-fragments）拓扑与活指针 `proj-05984a0f`，只在其 376 core 范围内选择绑定端点。
- 不执行生产运行态发布（`deploy:runtime`）；发布步骤只写进 tasks，执行时另行授权。
- 不新建第二个路径规划器或任何平行投影系统；不改消费方解析逻辑（launch map、查看器、路径与控灵接入属于后续 Change 2-6）。
- 不把 1236 张卡 JSON、信息图 PNG 等运行态资源提交进 git；涉及实际资源存在性的验收基于文件系统而非 git。
- 不处理例外账本之外的既存问题与推测性强化。

## Decisions

1. **卡片身份：crosswalk 消费替代无条件记账。** 为 633 张未绑定卡逐条生成 canonical 候选（按 `node_id`、标题与卡名索引召回），经独立语义评审后写入 `card-crosswalk.jsonl`；restage 绑定通道改为先查卡 frontmatter `canonical_id`、再查 crosswalk，两者皆无才记 `no-exact-identity` 账本。备选是继续无条件记账并事后清理；拒绝，因为账本已成为无消费者的垃圾通道。`card-name-index.json` 的 4279 个未解析 canonicalKey 在同一轮评审中补齐或记显式豁免。

2. **信息图：新增 `infographic` 资源类型，按身份源分两路绑定。** `TEACHING_RESOURCE_TYPES` 增 `infographic`；`infographs/authority/nodes/*.png` 文件名即 canonical token，直接精确绑定 EXPLAINS；`infographs/nodes/*.png` 按 legacy node_id 走与卡片相同的 crosswalk/评审通道。备选是只做 authority 一路；拒绝，因为 161 张 legacy 图是学生端实际服务的内容。

3. **core-nodes：从 prerequisite 出版物喂回。** restage 读取 `course-content/runtime/knowledge/prerequisites/releases/<pub>/core-nodes.json` 的 pathEligible core 集合写入投影 authoring，替代 `:438` 硬编码空数组；`<pub>` 取与当前投影 Authority release 一致的出版物。备选是继续空数组并在消费端兜底；拒绝，因为空 core-nodes 会让 core 相关 UI 与门禁判断失真。

4. **lesson/step 盘点重新并入。** `active-inventory.ts` 的课次/步骤盘点结果并入 restage 输入，lesson/step 作为投影资源类型恢复在场。备选是维持缺失；拒绝，因为 lesson/step 是课程播放主干（DB BOPPPS）与投影的对账基础。

5. **单元绑定缺口：补声明而非改文件存在性。** 讲义 3-9 / 5-5 / 5-6 与习题 5-6 的文件本身存在，缺口在没有任何 canonical 节点携带这三个单元的标记。修复方式是为这三个单元的 canonical 节点补教学绑定声明（coresByUnit 非空），使既有讲义/习题绑定通道自然生效，而不是给单个资源开特例。

6. **仿真关联：数据源内补 canonical；lesson02 按已退役课程直接清理。** Odyssey 在 `level-data.ts` 关卡数据补 canonical 关联字段，替代 restage 硬编码 `relatedNodeIds: []`；Arena `seed-challenges.ts` 的 `relatedKnowledge` 升级为 canonical id；lesson02 已经用户裁决为已退役课程（旧建模复习课，其 mechanical/electrical/analogy 与 `physics-modeling-*` 通用件语义重复），**不补映射、不占例外账本**：16 条 `launcher-lesson02-*` 记录从绑定分母直接清理——盘点侧登记退役排除清单，数据源侧删除残留 DB launcher 行（清理前验证无活引用：课次路由、教案、课堂实例均不引用）。55 条 `classroom-sim-without-unit` 逐条评审：能归属课次的补课次前缀，否则记显式永久例外。

7. **Franklin：crosswalk 端点对准 overlay core 内节点。** `ctc:v11g-*` 4 个端点不在 376 core 内，不改 overlay A；做法是修正 Franklin crosswalk，使每行端点落在 overlay core 内最近的语义等价节点，经独立语义评审确认。无等价节点的行进显式例外账本。

8. **账本治理：分类配额 + 消费者。** 例外账本接入治理报告（每类原因的计数、趋势与条目清单成为治理报告的一等输出）；`--allow-ledger 900` 改为按原因类别的配额（如 `no-exact-identity`、`classroom-sim-without-unit`、`explicit-exemption` 各自阈值），随缺口闭合逐步收紧到仅剩显式豁免。备选是保留总量阈值；拒绝，因为总量阈值无法区分"已豁免"与"未处理"。

## Risks / Trade-offs

- [633 张卡语义映射误判] → 生成候选只作输入，每条 crosswalk 行必须经独立语义评审；评审不通过的记 `no-exact-identity` 继续挂账，不得强行绑定。
- [core-nodes 出版物与 Authority release 不一致] → restage 校验出版物 identity 与投影 Authority release 匹配，不匹配则 fail closed。
- [信息图按 canonical token 绑定撞名] → authority 目录文件名 token 必须精确等于 overlay core canonical id，否则进账本，不做前缀/模糊匹配。
- [lesson02 清理误删活引用] → 清理前验证课次路由、教案、课堂实例均不引用这 16 条记录；清理经退役排除清单登记，可从数据源恢复重建。
- [配额收紧过早导致 restage 不可发布] → 分类配额初始值设为当前各类实际数，随闭合逐类下调，每次下调是一次独立可回退的配置变更。
- [运行态资源不被 git 跟踪] → 验收以文件系统盘点为准；CI 侧 git 夹具门禁维持 fail-closed，不冒充产品覆盖分母。

## Migration Plan

1. 本地完成卡片 crosswalk 评审、仿真关联与单元绑定声明的数据改造。
2. 改 restage 管线（crosswalk 消费、信息图枚举、active-inventory 并入、core-nodes 喂回、分类配额），本地重发布 B′′ 并跑投影 gate。
3. 例外账本分类配额随 B′′ 实际剩余调整，治理报告接入账本消费者。
4. PR 合入 `integration`；生产 `deploy:runtime` 步骤单列，执行时另行授权。
5. 回滚：投影指针拨回 B′（`proj-d22e0cca`），账本配额回到总量 900。

## Open Questions

1. ~~lesson02 映射~~ **已定案（2026-09-06 用户裁决）**：lesson02 是已退役课程，16 条 `launcher-lesson02-*` 不映射、不记例外，直接清理（决策 6）。
2. `card-name-index.json` 的 4279 个未解析 canonicalKey 中，预期有多少属于已退役资源（直接豁免）而非待解析卡？需在任务 1 的盘点阶段给出分类计数。
3. 信息图 legacy 目录 161 张中是否存在已退役节点 id（overlay core 内无对应）？若是，按退役豁免处理，不做跨图猜测。
